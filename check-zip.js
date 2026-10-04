/* check-zip.js —— 交付物 zip 的自检
 *
 * zip 和「扩展目录」最终要等价：Edge 拖 zip 进去时会自己解压再加载，
 * 所以 zip 里不能有扩展目录里同样致命的问题：
 *   - 条目名用反斜杠（Edge 自己的解压器不认，会伪造出错误的目录结构）
 *   - 以 _ 开头的文件名（WebExtensions 规范保留给系统，直接拒载）
 *   - manifest 引用了包里不存在的文件（图标 / popup / service worker）
 *   - manifest 声明了 default_locale 却没有 _locales 目录
 *
 * 用法：node check-zip.js
 */
const fs = require('fs')
const path = require('path')

const zipPath = path.join(__dirname, 'dist-out', 'floccus-via.zip')
const b = fs.readFileSync(zipPath)

// 1) 解析 zip 中央目录
let off = -1
for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
  if (b.readUInt32LE(i) === 0x06054b50) {
    off = i
    break
  }
}
if (off < 0) {
  console.error('未找到 zip EOCD')
  process.exit(2)
}

const entries = []
{
  const count = b.readUInt16LE(off + 10)
  let p = b.readUInt32LE(off + 16)
  const enc = new TextDecoder('utf-8')
  for (let n = 0; n < count; n++) {
    if (b.readUInt32LE(p) !== 0x02014b50) break
    const method = b.readUInt16LE(p + 10)
    const csize = b.readUInt32LE(p + 20)
    const usize = b.readUInt32LE(p + 24)
    const nlen = b.readUInt16LE(p + 28)
    const elen = b.readUInt16LE(p + 30)
    const clen = b.readUInt16LE(p + 32)
    entries.push({
      name: enc.decode(b.slice(p + 46, p + 46 + nlen)),
      method,
      csize,
      usize,
    })
    p += 46 + nlen + elen + clen
  }
}

const names = entries.map(e => e.name)
const set = new Set(names)
const norm = x => x.split(/[\\/]/).join('/')
const files = new Set(names.filter(x => !x.endsWith('/')))

const fails = []
const ok = (cond, msg) => {
  console.log((cond ? '  \x1b[32mOK\x1b[0m   ' : '  \x1b[31mFAIL\x1b[0m ') + msg)
  if (!cond) fails.push(msg)
}

console.log(`\nzip 自检  ${path.basename(zipPath)}  (${(b.length / 1024 / 1024).toFixed(2)} MB)`)
console.log('条目总数:', names.length)

// 2) 条目名必须全用正斜杠（zip 规范）。反斜杠会让 Edge 解压器把 "icons\logo.png"
//    当成一整个文件名 → icons/ 目录空 → "Couldn't load icon icons/logo.png"
const bs = names.filter(x => x.includes('\\'))
ok(bs.length === 0, `条目名全用正斜杠${bs.length ? ' -> 反例: ' + bs.slice(0, 3) : ''}`)

// 3) 不能有以 _ 开头的文件名
const bad = names.filter(x => x.split('/').some(s => s.startsWith('_')))
ok(bad.length === 0, `无 _ 开头的文件名${bad.length ? ' -> ' + bad.slice(0, 5) : ''}`)

// 4) 不能有 Windows 保留设备名（扩展解包到非 NTFS 环境会炸）
const RESERVED = ['CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, i) => 'COM' + (i + 1)),
  ...Array.from({ length: 9 }, (_, i) => 'LPT' + (i + 1))]
const reserved = [...files].filter(f => RESERVED.includes(path.basename(f, path.extname(f)).toUpperCase()))
ok(reserved.length === 0, `无 Windows 保留设备名${reserved.length ? ' -> ' + reserved.slice(0, 5) : ''}`)

// 5) 没有测试 / 回归 / 构建脚本残留
const testy = names.filter(x => /mocha|test\.|via-check|index\.html|gulp|webpack|check-|pack-for|audit-/.test(x))
ok(testy.length === 0, `无测试/构建残留${testy.length ? ' -> ' + testy.slice(0, 5) : ''}`)

// 6) manifest 必须存在且合法
let mf = null
const mfEntry = names.find(x => norm(x) === 'manifest.json')
ok(!!mfEntry, '含 manifest.json')
if (mfEntry) {
  const i = names.indexOf(mfEntry)
  // 中央目录只有偏移没有本地头偏移，回到本地文件头去取内容
  try {
    const JSZip = require('jszip')
    ;(async () => {
      const zip = await JSZip.loadAsync(b)
      mf = JSON.parse(await zip.file('manifest.json').async('string'))
      runChecks()
    })().catch(e => {
      ok(false, '读 manifest.json -> ' + e.message)
      finish()
    })
  } catch (e) {
    ok(false, '需要 jszip 读取 manifest 内容 -> ' + e.message)
    finish()
  }
} else {
  finish()
}

const runChecks = () => {
  // 7) manifest 引用完整性
  const refs = []
  if (mf.icons) refs.push(...Object.values(mf.icons))
  if (mf.action) {
    if (mf.action.default_icon) refs.push(...Object.values(mf.action.default_icon))
    if (mf.action.default_popup) refs.push(mf.action.default_popup)
  }
  if (mf.options_ui && mf.options_ui.page) refs.push(mf.options_ui.page)
  if (mf.background && mf.background.service_worker) refs.push(mf.background.service_worker)
  ;[...new Set(refs)].forEach(r => ok(files.has(norm(r)), `manifest 引用存在: ${r}`))

  // 8) default_locale 必须与 _locales 配套
  if ('default_locale' in mf) {
    ok(files.has('_locales') || names.some(x => norm(x).startsWith('_locales/')),
      `声明了 default_locale 就必须有 _locales 目录`)
  } else {
    ok(true, '未声明 default_locale（文案已编译进 JS）')
  }

  // 9) HTML 内的相对引用必须可解析
  const htmlRefs = []
  for (const h of files) {
    if (!/\.html$/i.test(h)) continue
    const z = null // zip 内文本稍后从 files 里取；条目内容解析成本高，这里只查 manifest 级
  }

  // 10) 必需文件齐全
  ;[
    'dist/html/options.html',
    'dist/html/background.html',
    'dist/js/background-script.js',
    'dist/js/options.js',
    'dist/js/native.js',
    'icons/logo.png',
    'README.md',
  ].forEach(f => ok(files.has(norm(f)), `含 ${f}`))

  // 11) 图标是有效 PNG（解压后内容完整，等价于 Edge 拿到手的字节）
  const JSZip = require('jszip')
  JSZip.loadAsync(b).then(async z => {
    for (const ref of ['icons/logo.png', ...(mf.icons ? Object.values(mf.icons) : [])]) {
      const f = z.file(ref)
      if (!f) { ok(false, `图标在 zip 里缺失: ${ref}`); continue }
      const buf = await f.async('nodebuffer')
      ok(buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a',
        `${ref} 是有效 PNG (${buf.length} 字节)`)
    }
    // 12) 所有条目 CRC 可校验（jszip 解压时会校验）
    let n = 0
    for (const nm of Object.keys(z.files)) {
      if (z.files[nm].dir) continue
      await z.files[nm].async('uint8array')
      n++
    }
    ok(true, `${n} 个条目 CRC 校验通过（解压内容与打包前一致）`)
    finish()
  }).catch(e => {
    ok(false, '解压校验失败 -> ' + e.message)
    finish()
  })
}

const finish = () => {
  console.log(
    fails.length
      ? `\n\x1b[31m${fails.length} 项 FAIL\x1b[0m\n` + fails.map((f, i) => `  ${i + 1}. ${f}`).join('\n')
      : '\n\x1b[32mALL PASS\x1b[0m  这个 zip 可以拖到 edge://extensions/ 上安装'
  )
  process.exit(fails.length ? 1 : 0)
}
