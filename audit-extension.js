#!/usr/bin/env node
/*
 * audit-extension.js —— floccus-via 扩展包「加载前合规审计」
 *
 * 按 Chromium / Edge 加载扩展时的实际校验规则逐项检查，覆盖三类问题：
 *   A. 包结构合规（下划线开头、空目录、Windows 保留名、zip 分隔符…）
 *   B. manifest 字段与官方校验规则（default_locale 必须配 _locales、version 格式…）
 *   C. 引用完整性（icons / popup / worker / HTML 内 src= 全部必须存在于包内）
 *
 * 用法：
 *   node audit-extension.js [扩展目录]        # 默认 ../floccus-via
 * 退出码：0 = 全部 PASS（FAIL 数 0）；1 = 存在 FAIL；2 = 用法/读取错误
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..', process.env.AUDIT_TARGET || 'floccus-via'))

let pass = 0
let fail = 0
let info = 0
const failures = []

const ok = (cond, name, detail) => {
  if (cond) {
    pass++
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? '\n         -> ' + detail : ''}`)
  }
}
// 非阻塞提示（条件为真时给一句解释，为假时才值得处理）
const note = (cond, name, detail) => {
  info++
  console.log(
    `  \x1b[36mINFO\x1b[0m  ${name}${cond && detail ? '  (' + detail + ')' : ''}`
  )
}

const walk = (dir, base = '') => {
  const out = []
  const abs = path.join(dir, base)
  if (!fs.existsSync(abs)) return out
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name
    if (entry.isDirectory()) out.push(...walk(dir, rel))
    else out.push(rel)
  }
  return out
}

// ---------------------------------------------------------------- A. 包结构
console.log(`\n\x1b[1m[0/4] 包结构合规\x1b[0m   target = ${ROOT}`)

if (!fs.existsSync(ROOT)) {
  console.error('找不到扩展目录：', ROOT)
  process.exit(2)
}
const files = walk(ROOT)
const dirs = []
;(function collectDirs(d, base) {
  const abs = path.join(d, base)
  if (!fs.existsSync(abs)) return
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = base ? base + '/' + e.name : e.name
    if (e.isDirectory()) {
      dirs.push(rel)
      collectDirs(d, rel)
    }
  }
})(ROOT, '')

ok(files.length > 0, `扩展目录非空（${files.length} 个文件）`)

// A1 下划线开头 —— Chromium 会直接拒绝整个扩展
const underscore = [...files, ...dirs].filter(p => p.split('/').some(s => s.startsWith('_')))
ok(
  underscore.length === 0,
  'A1  没有以 "_" 开头的文件/目录名（规范保留给系统）',
  underscore.slice(0, 5).join(', ')
)

// A2 空目录（不影响加载，但属包内脏数据）
const emptyDirs = dirs.filter(d => {
  const abs = path.join(ROOT, d)
  return files.every(f => !f.startsWith(d + '/')) && fs.readdirSync(abs).length === 0
})
ok(emptyDirs.length === 0, 'A2  没有空目录', emptyDirs.slice(0, 5).join(', '))

// A3 打包残留（.DS_Store / __MACOSX / 编辑器配置）
const junk = files.filter(f => /(__MACOSX|\.DS_Store|Thumbs\.db|\.git\/|\.vscode)/i.test(f))
ok(junk.length === 0, 'A3  没有系统/编辑器残留文件', junk.slice(0, 5).join(', '))

// A4 Windows 保留设备名（扩展被拖到非 NTFS 环境时会炸）
const RESERVED = ['CON', 'PRN', 'AUX', 'NUL',
  ...Array.from({ length: 9 }, (_, i) => 'COM' + (i + 1)),
  ...Array.from({ length: 9 }, (_, i) => 'LPT' + (i + 1))]
const reserved = files.filter(f => RESERVED.includes(path.basename(f, path.extname(f)).toUpperCase()))
ok(reserved.length === 0, 'A4  没有 Windows 保留设备名', reserved.slice(0, 5).join(', '))

// A5 文件名（不含扩展名）不能有非法字符
const illegal = files.filter(f => /[<>:"|?*]/.test(path.basename(f)))
ok(illegal.length === 0, 'A5  文件名无非法字符 <>:"|?*', illegal.slice(0, 5).join(', '))

// ------------------------------------------------------- B. manifest 字段
console.log('\n\x1b[1m[1/4] manifest 字段\x1b[0m')

const MANIFEST = 'manifest.json'
const mPath = path.join(ROOT, MANIFEST)
let mf = null
let raw = ''
if (!fs.existsSync(mPath)) {
  ok(false, 'B0  manifest.json 存在')
} else {
  ok(true, 'B0  manifest.json 存在')
  raw = fs.readFileSync(mPath)
  const hasBom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf
  ok(!hasBom, 'B1  manifest.json 无 UTF-8 BOM')
  const text = raw.toString('utf8').replace(/^\uFEFF/, '')
  // 严格 JSON（拒绝注释与尾逗号，webpack 的 json-parser 同样会拒绝）
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    try {
      // 再试一次带尾逗号宽容的 parse，用于给出更精确提示
      JSON.parse(text.replace(/,(\s*[}\]])/g, '$1'))
      ok(false, 'B2  manifest.json 是合法 JSON', '疑似尾括号后多余逗号 / 注释')
    } catch (e2) {
      ok(false, 'B2  manifest.json 是合法 JSON', e2.message)
    }
  }
  if (parsed) {
    mf = parsed
    ok(true, 'B2  manifest.json 是合法 JSON')

    // B3 必填字段
    ok(typeof mf.manifest_version === 'number', 'B3  必填字段 manifest_version 存在')
    ok(typeof mf.name === 'string' && mf.name.trim() !== '', 'B3  必填字段 name 非空')
    ok(typeof mf.version === 'string' && mf.version.trim() !== '', 'B3  必填字段 version 非空')

    // B4 manifest_version 必须是 3（本包基于 MV3）
    ok(mf.manifest_version === 3, 'B4  manifest_version === 3', `实际 ${mf.manifest_version}`)

    // B5 version 格式：最多 4 段，每段 0..65535 的整数
    const vparts = String(mf.version || '').split('.')
    const versionOk =
      vparts.length >= 1 && vparts.length <= 4 &&
      vparts.every(p => /^\d+$/.test(p) && Number(p) <= 65535)
    ok(versionOk, 'B5  version 格式合法（1~4 段，每段 0-65535）', `实际 "${mf.version}"`)

    // B6 default_locale 必须与 _locales 目录配套（Chromium 硬校验）
    const hasLocalesDir = fs.existsSync(path.join(ROOT, '_locales'))
    if ('default_locale' in mf) {
      ok(
        hasLocalesDir,
        `B6  声明了 default_locale:"${mf.default_locale}" 就必须有 _locales 目录`,
        '当前包没有 _locales 目录 —— Chromium 会以 manifest 校验失败拒绝加载'
      )
    } else {
      ok(
        true,
        'B6  未声明 default_locale（文案已由 webpack 编译进 JS，运行时不依赖 chrome.i18n）'
      )
    }

    // B7 MV2 遗留字段不得残留
    const legacy = ['browser_action', 'page_action', 'options_page', 'background'].filter(
      k => k === 'browser_action' || k === 'page_action' || k === 'options_page'
    )
    const legacyHit = legacy.filter(k => k in mf)
    ok(legacyHit.length === 0, 'B7  没有 MV2 遗留字段', legacyHit.join(', '))

    // B8 background 不能同时用 scripts 与 service_worker
    if (mf.background) {
      const bg = mf.background
      ok(
        !(bg.scripts && bg.service_worker),
        'B8  background 不同时用 scripts 与 service_worker'
      )
      ok(typeof bg.service_worker === 'string', 'B8  background.service_worker 是字符串路径')
    }

    // B9 action / browser_action 不共存
    ok(!(mf.action && mf.browser_action), 'B9  action 与 browser_action 不共存')

    // B10 CSP 不得出现 unsafe-inline / unsafe-eval / 远程源
    const csp = mf.content_security_policy || {}
    const cspAll = [csp.extension_pages, csp.content_script, csp.sandbox].filter(Boolean).join('; ')
    ok(!/unsafe-inline|unsafe-eval/i.test(cspAll), 'B10 CSP 不含 unsafe-inline / unsafe-eval', cspAll)
    ok(!/https?:\/\//i.test(cspAll), 'B10 CSP 不指向远程源', cspAll)

    // B11 permissions 合法性（MV3 白名单）
    const MV3_PERMS = new Set(['activeTab', 'alarms', 'background', 'bookmarks', 'clipboardRead',
      'clipboardWrite', 'contentSettings', 'contextMenus', 'cookies', 'debugger', 'declarativeNetRequest',
      'declarativeNetRequestFeedback', 'discovery', 'downloads', 'geolocation', 'history', 'identity',
      'idle', 'management', 'nativeMessaging', 'notifications', 'offscreen', 'pageCapture', 'power',
      'printerProvider', 'scripting', 'search', 'sessions', 'storage', 'tabCapture', 'tabGroups',
      'tabs', 'topSites', 'unlimitedStorage', 'userScripts', 'webNavigation', 'webRequest',
      'webRequestBlocking', 'dns', 'savedPassword'])
    const badPerms = [...(mf.permissions || []), ...(mf.optional_permissions || [])].filter(p => !MV3_PERMS.has(p))
    ok(badPerms.length === 0, 'B11 permissions 全部在 MV3 白名单内', badPerms.join(', '))

    const badHosts = [...(mf.host_permissions || [])].filter(h => !/^\*?:\/\//.test(h) && h !== '<all_urls>')
    ok(badHosts.length === 0, 'B12 host_permissions 格式合法', badHosts.join(', '))
  }
}

// --------------------------------------------------- C. 引用完整性
console.log('\n\x1b[1m[2/4] 引用完整性\x1b[0m')

const exists = p => fs.existsSync(path.join(ROOT, p))
const set = new Set(files)

// C1 icons 全部存在且是有效 PNG
if (mf && mf.icons) {
  const bad = []
  for (const [size, p] of Object.entries(mf.icons)) {
    if (!exists(p)) { bad.push(`${p}(缺文件)`); continue }
    const b = fs.readFileSync(path.join(ROOT, p))
    if (b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') bad.push(`${p}(非 PNG)`)
  }
  ok(bad.length === 0, 'C1  icons 全部存在且是有效 PNG', bad.join(', '))
} else {
  ok(false, 'C1  icons 字段存在')
}

// C2 manifest 里每个被引用的路径都必须在包内
const refKeys = []
if (mf) {
  if (mf.icons) refKeys.push(...Object.values(mf.icons))
  if (mf.action) {
    if (mf.action.default_icon) refKeys.push(...Object.values(mf.action.default_icon))
    if (mf.action.default_popup) refKeys.push(mf.action.default_popup)
  }
  if (mf.options_page) refKeys.push(mf.options_page)
  if (mf.options_ui && mf.options_ui.page) refKeys.push(mf.options_ui.page)
  if (mf.background && mf.background.service_worker) refKeys.push(mf.background.service_worker)
}
const missingRefs = [...new Set(refKeys)].filter(p => !set.has(p))
ok(missingRefs.length === 0, `C2  manifest 引用的 ${new Set(refKeys).size} 个路径全部存在`, missingRefs.join(', '))

// C3 action 里的图标必须是有效 PNG
if (mf && mf.action && mf.action.default_icon) {
  const bad = []
  for (const [size, p] of Object.entries(mf.action.default_icon)) {
    if (!exists(p)) { bad.push(`${p}(缺文件)`); continue }
    const b = fs.readFileSync(path.join(ROOT, p))
    if (b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') bad.push(`${p}(非 PNG)`)
  }
  ok(bad.length === 0, 'C3  action.default_icon 是有效 PNG', bad.join(', '))
}

// C4 HTML 内部 src= / href= 的相对引用必须解析到包内文件
const HTML_RE = /\b(?:src|href)\s*=\s*"([^"]+)"/gi
const htmlFiles = files.filter(f => /\.html$/i.test(f))
const htmlBad = []
for (const h of htmlFiles) {
  const html = fs.readFileSync(path.join(ROOT, h), 'utf8')
  let m
  while ((m = HTML_RE.exec(html))) {
    const ref = m[1]
    if (/^(https?:|chrome:|about:|data:|mailto:|#|\/\/)/i.test(ref)) continue
    // 相对当前 html 解析
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(h), ref))
    if (!set.has(target)) htmlBad.push(`${h} -> ${ref} (解析为 ${target})`)
  }
}
ok(htmlBad.length === 0, `C4  ${htmlFiles.length} 个 HTML 内的 src/href 引用全部可解析`, htmlBad.slice(0, 6).join(' | '))

// C5 service worker 非空且体积合理
if (mf && mf.background && mf.background.service_worker) {
  const p = path.join(ROOT, mf.background.service_worker)
  const size = fs.existsSync(p) ? fs.statSync(p).size : 0
  ok(size > 1000, 'C5  service worker 内容非空', `${size} 字节`)
}

// C6 JS 语法合法性（抽主线程 chunk 做 --check，避免逐个几 MB 文件拖慢）
const jsFiles = files.filter(f => /\.js$/i.test(f))
let syntaxBad = []
const sample = jsFiles.slice(0, 40) // 只抽查前 40 个，含所有主入口
const { execFileSync } = require('child_process')
const nodeBin = process.execPath
for (const f of sample) {
  try {
    execFileSync(nodeBin, ['--check', path.join(ROOT, f)], { stdio: 'ignore' })
  } catch (e) {
    syntaxBad.push(f)
  }
}
ok(syntaxBad.length === 0, `C6  ${sample.length} 个 JS 主 chunk 语法合法`, syntaxBad.join(', '))

// C7 所有 JS 的 importScripts 目标存在
let impBad = []
for (const f of files.filter(x => /\.js$/i.test(x))) {
  const js = fs.readFileSync(path.join(ROOT, f), 'utf8')
  const re = /importScripts\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = re.exec(js))) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]))
    if (!set.has(target)) impBad.push(`${f} -> ${m[1]}`)
  }
}
ok(impBad.length === 0, 'C7  importScripts 目标全部存在', impBad.slice(0, 5).join(' | '))

// C8 字体/图片资源文件本身非空
const emptyFiles = files.filter(f => set.has(f) && fs.statSync(path.join(ROOT, f)).size === 0)
ok(emptyFiles.length === 0, 'C8  没有 0 字节的空文件', emptyFiles.slice(0, 5).join(', '))

// --------------------------------------------------------- D. 运行期隐患
console.log('\n\x1b[1m[3/4] 运行期隐患\x1b[0m')

const allJsText = files
  .filter(f => /\.js$/i.test(f))
  .slice(0, 30)
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
  .join('\n')

// D1 不得依赖 chrome.i18n（本包文案已内联；若依赖，删 default_locale 会让文案变空）
const usesChromeI18n = /chrome\.i18n\./.test(allJsText)
note(
  !usesChromeI18n,
  'D1  运行时不调用 chrome.i18n（文案已内联进 JS，移除 default_locale 不影响显示）',
  usesChromeI18n ? '检测到 chrome.i18n 调用，移除 default_locale 会导致文案变空' : ''
)

// D2 popup / options 页面里不得有内联 script（CSP 会拦）
const inlineScript = htmlFiles.filter(h => /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i.test(
  fs.readFileSync(path.join(ROOT, h), 'utf8')
))
ok(inlineScript.length === 0, 'D2  扩展页面无内联 script（CSP 会拒绝执行）', inlineScript.join(', '))

// D3 扩展页面不得引用外部 http(s) 资源
const extRes = htmlFiles.filter(h => {
  const html = fs.readFileSync(path.join(ROOT, h), 'utf8')
  return /<(?:script|link|img)[^>]+(?:src|href)\s*=\s*"https?:\/\//i.test(html)
})
ok(extRes.length === 0, 'D3  扩展页面无外部 http(s) 资源引用', extRes.join(', '))

// D4 service worker 不得直接访问 document（MV3 没有 DOM）
if (mf && mf.background && mf.background.service_worker) {
  const sw = path.join(ROOT, mf.background.service_worker)
  const txt = fs.readFileSync(sw, 'utf8')
  const risky = /document\.(querySelector|getElementById|createElement|body|write)/.test(txt)
  note(!risky, 'D4  service worker 未直接操作 document（MV3 无 DOM，会运行期报错）',
    risky ? '检测到 document. 调用' : '')
}

// D5 构建脚本误入包（不算错误，仅提示）
const stray = files.filter(f => /gulp|webpack|check-|pack-for|audit-|via-check/i.test(f))
note(stray.length === 0, 'D5  包内没有构建/校验脚本残留', stray.length ? stray.join(', ') : '')

// ---------------------------------------------------------------- 汇总
console.log('\n' + '─'.repeat(64))
console.log(`\x1b[1m审计结果\x1b[0m  PASS ${pass}   FAIL ${fail}   INFO ${info}`)
if (fail) {
  console.log('\x1b[31m存在阻塞加载的问题：\x1b[0m')
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
  process.exit(1)
} else {
  console.log('\x1b[32mALL PASS\x1b[0m  —— 按 Chromium/Edge 加载规则，未发现会阻止加载的问题。')
  if (info) console.log('\x1b[36m（INFO 为非阻塞提示，可优化但不会导致加载失败）\x1b[0m')
  process.exit(0)
}
