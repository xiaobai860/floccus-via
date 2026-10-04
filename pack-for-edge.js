/* eslint-disable no-console */
// 把 gulp 的构建产物组装成可以直接在 Edge 里「加载已解压的扩展程序」的目录。
// 用法：node pack-for-edge.js
//
// floccus 发布时的 zip 结构是 dist/** + 顶层 manifest.json + icons + _locales，
// 这里照同样的结构组装，但产出一个可直连加载的目录（外加一个 zip 备份）。
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const DIST = path.join(ROOT, 'dist')
const OUT = path.join(ROOT, '..', 'floccus-via')
const OUT_NAME = 'floccus-via'

// 构建产物里混着的测试 / 回归脚本产物，扩展运行时用不到，别跟着进包
const SKIP_FILES = new Set([
  'mocha.js',
  'mocha.css',
  'test.js',
  'test.js.map',
  'test.html',
  'index.html', // 原生 App（Android/iOS）的入口，浏览器扩展用不上
  'via-check.js',
])
// dist/via-check 和 dist/official-check 都是回归脚本 webpack 的产物（bundle.js + vendors
// chunk，几 MB），只用来跑 node dist/*/bundle.js，扩展运行时不读，必须挡在包外。
const SKIP_DIRS = new Set(['via-check-tsc', 'via-check', 'official-check', 'css']) // dist/css 只有 mocha 样式

const copyRecursive = (src, dest) => {
  if (SKIP_DIRS.has(path.basename(src))) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      if (SKIP_FILES.has(entry)) continue
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    if (SKIP_FILES.has(path.basename(src))) return
    // source map 只在 devtools 里用得到，塞进扩展包只是白拖几 MB（拖 zip 时整包要复制到 AppData）
    if (path.extname(src) === '.map') return
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

const rmRecursive = (target) => {
  if (!fs.existsSync(target)) return
  for (const entry of fs.readdirSync(target)) {
    const full = path.join(target, entry)
    if (fs.statSync(full).isDirectory()) rmRecursive(full)
    else fs.unlinkSync(full)
  }
  fs.rmdirSync(target)
}

const main = () => {
  if (!fs.existsSync(DIST)) {
    console.error('找不到 dist/，请先跑 npx gulp build')
    process.exit(1)
  }

  rmRecursive(OUT)
  fs.mkdirSync(OUT, { recursive: true })

  // 1) dist 全部内容
  copyRecursive(DIST, path.join(OUT, 'dist'))

  // 2) 扩展清单放到根（manifest.json 里的路径是 dist/...，所以必须放根目录）
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'))
  // 名字加 -via：和官方商店版（floccus bookmarks sync）在扩展管理页一眼能区分，
  // 也提醒自己这不是上游原版。
  manifest.name = 'floccus-via'
  manifest.short_name = 'floccus-via'
  manifest.version = manifest.version + '.0'
  manifest.description =
    'floccus fork：与 Via 浏览器书签双向同步（坚果云 / WebDAV 里的 bookmarks.html）'
  fs.writeFileSync(
    path.join(OUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  )

  // 3) 图标、LICENSE
  // 注意：不要再拷 _locales/ 进来。它被包进 dist 的 JS chunk 里了（dist 下就没有这个目录），
  // 而 `_` 开头的目录名是 WebExtensions 保留名——打包成 zip 用 Edge「加载压缩包」时，
  // 解压目录里出现 _locales 会直接报
  // "Cannot load extension with file or directory name _locales\xx\messages.json" 导致加载失败。
  // 只拷 icons。lib/ 里只有构建脚本 gulp-crx.js，是给 gulp 用的，不是运行时依赖，
  // 拷进扩展包等于把构建脚本暴露给用户，删掉。
  ;['icons'].forEach(dir => {
    const src = path.join(ROOT, dir)
    if (fs.existsSync(src)) copyRecursive(src, path.join(OUT, dir))
  })
  ;['LICENSE.txt', 'PRIVACY_POLICY.md'].forEach(f => {
    const src = path.join(ROOT, f)
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f))
  })

    // 使用说明（这份 README 写在源码侧的 README.via.md，打包时同步一份进扩展目录）
  const readmeSrc = path.join(ROOT, 'README.via.md')
  if (fs.existsSync(readmeSrc)) fs.copyFileSync(readmeSrc, path.join(OUT, 'README.md'))

  // 可选：把 source map 塞回包里（默认剔除）。
  // 上游 gulp 的 chromeZip 任务是不排除 .map 的，所以「和官方包一模一样」打出来的 zip 会明显更大
  // （实测 dist 部分 4.86 MB → 10.88 MB）。默认剔掉，因为 map 只给 devtools 看，运行时用不到。
  if (process.argv.includes('--with-maps')) {
    const mapsDir = path.join(OUT, 'dist', 'js')
    let n = 0
    const copyMaps = (dir) => {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (fs.statSync(full).isDirectory()) copyMaps(full)
        else if (path.extname(entry) === '.map') {
          fs.copyFileSync(full, path.join(mapsDir, entry))
          n++
        }
      }
    }
    copyMaps(path.join(DIST, 'js'))
    console.log('（--with-maps：塞回 ' + n + ' 个 source map，zip 会大 6 MB 左右）')
  }

  // 4) zip 备份（可以直接拖到 edge://extensions/ 上安装）
  //
  // 注意：这里绝不能用 PowerShell 的 Compress-Archive / .NET 的 ZipFile。
  // 在 Windows 上它们会把条目的名字写成反斜杠（"icons\logo.png"）而不是 zip 规范要求的
  // 正斜杠（"icons/logo.png"）。Windows 资源管理器解压时能把反斜杠还原成目录，所以看不出问题，
  // 但 Edge / Chromium 自己的解压器会把 "icons\logo.png" 当成一整个文件名，
  // 结果 icons 目录是空的、manifest 里的 icons/logo.png "不存在"，
  // 于是拖 zip 加载时报 "Couldn't load icon icons/logo.png specified in action."。
  const zipPath = path.join(ROOT, OUT_NAME + '.zip')
  const files = []
  const walk = (dir, base) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry)
      const rel = base ? base + '/' + entry : entry
      if (fs.statSync(full).isDirectory()) walk(full, rel)
      else files.push([full, rel])
    }
  }
  walk(OUT, '')

  const JSZip = require('jszip')
  const zip = new JSZip()
  // 显式声明目录条目，免得某些解压器（含 Chromium）建不出中间目录
  const dirs = new Set()
  files.forEach(([, rel]) => {
    const parts = rel.split('/')
    parts.pop()
    for (let i = 1; i <= parts.length; i++) dirs.add(parts.slice(0, i).join('/'))
  })
  dirs.forEach(d => zip.folder(d))
  files.forEach(([full, rel]) => zip.file(rel, fs.readFileSync(full)))

  zip
    .generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })
    .then(buf => {
      fs.writeFileSync(zipPath, buf)
      console.log('zip ->', zipPath, (buf.length / 1024 / 1024).toFixed(2) + ' MB')
    })
    .catch(e => {
      console.log('zip 生成失败，请直接加载目录：', OUT, '\n', e.message)
    })

  console.log('扩展目录 ->', OUT)
  console.log(fs.readdirSync(OUT).join('  '))
}

main()
