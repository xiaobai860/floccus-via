/**
 * i18n 覆盖检查
 * ------------------------------------------------------------------
 * 目的：找出「源码里 t('Xxx') 引用了、但某个语言包里没有」的文案。
 * 这类缺口在 UI 上表现为直接露出英文原文，因为 I18n.doGetMessage 找不到时会
 * 逐 key 回退到 default locale（en）。
 *
 * 注意：正则必须限定在 `t('Key')` / `$t('Key')` 上，且前面不能是字母/数字/下划线，
 * 否则 `get('a')`、`grep('...')` 这类普通调用会被误判成文案 key（本项目曾因此
 * 产生 40+ 条假缺口）。同时只认 CamelCase 开头的 key，符合 _locales 命名惯例。
 */
const fs = require('fs')
const path = require('path')

const LOCALES = '_locales'
const SRC = 'src'

// 1. 收集源码里真正的文案引用。
//    规则：`t('Key')` 或 `$t('Key')`，Key 为 CamelCase（大写开头），
//    且左括号前不能是标识符字符或 $（否则 get('a')、grep('..') 会被误判）。
const KEY_RE = /(?<![A-Za-z0-9_$])(?:\$?)t\('([A-Z][A-Za-z0-9_]*)'\)/g

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      walk(full, out)
    } else if (/\.(vue|js|ts|tsx)$/.test(entry.name)) {
      try {
        out.push(fs.readFileSync(full, 'utf8'))
      } catch (e) {
        /* 二进制等，跳过 */
      }
    }
  }
  return out
}

const sources = walk(SRC)
const usedSet = new Set()
for (const code of sources) {
  KEY_RE.lastIndex = 0
  let m
  while ((m = KEY_RE.exec(code))) usedSet.add(m[1])
}
const used = [...usedSet].sort()
console.log(`扫描源码文件 ${sources.length} 个，引用文案 key：${used.length} 个`)

// 2. 逐个语言包比对
const locales = fs.readdirSync(LOCALES).filter((d) =>
  fs.existsSync(path.join(LOCALES, d, 'messages.json'))
)

const rows = []
for (const loc of locales) {
  const file = path.join(LOCALES, loc, 'messages.json')
  let json
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.log(`✗ ${loc}/messages.json 解析失败：${e.message}`)
    continue
  }
  const missing = used.filter((k) => !Object.prototype.hasOwnProperty.call(json, k))
  const dead = Object.keys(json).filter((k) => !used.includes(k))
  rows.push({ loc, total: Object.keys(json).length, missing, dead, json })
}

console.log('\n=== 引用了却缺失（会因回退而露出英文）===')
let anyMissing = false
for (const r of rows) {
  if (r.missing.length) {
    anyMissing = true
    console.log(`[${r.loc}] 缺 ${r.missing.length} 个: ${r.missing.join(', ')}`)
  }
}
if (!anyMissing) console.log('（无）')

// 3. 重点：中文系语言包的缺口单独列出来，方便补翻译
const zhLocales = ['zh', 'zh_CN', 'zh-Hans', 'zh_TW']
const zhRows = rows.filter((r) => zhLocales.includes(r.loc))
console.log('\n=== 中文包缺口明细 ===')
for (const r of zhRows) {
  console.log(`\n[${r.loc}] 缺 ${r.missing.length} 个`)
  for (const k of r.missing) {
    console.log(
      `   ${k} → en: ${(r.json[k] && r.json[k].message) || (rows.find((x) => x.loc === 'en').json[k] || {}).message || '(en 也没有)'}`
    )
  }
}

console.log('\n=== 语言包规模 ===')
for (const r of rows) {
  console.log(
    `${r.loc.padEnd(8)} 词条=${String(r.total).padStart(4)}  未使用=${r.dead.length}  缺=${r.missing.length}`
  )
}

process.exitCode = anyMissing ? 1 : 0
