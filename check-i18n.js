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

function loadJson(loc) {
  try {
    return JSON.parse(fs.readFileSync(path.join(LOCALES, loc, 'messages.json'), 'utf8'))
  } catch (e) {
    return null
  }
}

/**
 * 与 src/lib/native/I18n.ts 的 getMessageChain() 保持一致的回退规则。
 *
 * 背景：本分支的 _locales 五个语言包保持【上游原样、零改动】，
 * 所以 zh_CN / zh-Hans 相对上游 en 会缺一些词条。但 I18n.ts 里那条
 * 「zh_CN / zh-Hans 先借道 zh 简体包，再回退 en」的逐 key 回退链能兜住它们，
 * 界面上不会露英文 —— 所以这些缺口是【合法且被兜住的】，不能报 FAIL。
 *
 * zh_TW 不在此列：它是繁体包，I18n 刻意不让它借道简体包（否则繁体用户
 * 会看到简体），所以它的缺口是真缺口。
 */
const FALLBACK_PROVIDERS = { zh_CN: ['zh'], 'zh-Hans': ['zh'] }

const rows = []
for (const loc of locales) {
  const json = loadJson(loc)
  if (!json) {
    console.log(`✗ ${loc}/messages.json 解析失败或不存在`)
    continue
  }
  const rawMissing = used.filter((k) => !Object.prototype.hasOwnProperty.call(json, k))
  // 把能被回退链兜住的缺口挪到 covered 列表，不计入 missing
  const providers = FALLBACK_PROVIDERS[loc] || []
  const covered = []
  const missing = []
  for (const k of rawMissing) {
    const hit = providers.some((p) => {
      const m = loadJson(p)
      return m && Object.prototype.hasOwnProperty.call(m, k)
    })
    if (hit) covered.push(k)
    else missing.push(k)
  }
  const dead = Object.keys(json).filter((k) => !used.includes(k))
  rows.push({ loc, total: Object.keys(json).length, missing, covered, dead, json })
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

// 2.5 被回退链兜住的缺口：说明白，避免以后误以为漏翻译
const anyCovered = rows.filter((r) => r.covered.length)
if (anyCovered.length) {
  console.log('\n=== 缺失但已被回退链兜住（不算缺口，界面不会露英文）===')
  for (const r of anyCovered) {
    console.log(
      `[${r.loc}] ${r.covered.length} 个，由 ${(FALLBACK_PROVIDERS[r.loc] || []).join('/')} 兜底: ${r.covered.join(', ')}`
    )
  }
}

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
  const cov = r.covered.length ? `  回退兜底=${r.covered.length}` : ''
  console.log(
    `${r.loc.padEnd(8)} 词条=${String(r.total).padStart(4)}  未使用=${r.dead.length}  缺=${r.missing.length}${cov}`
  )
}

// 本分支的硬约束：_locales 必须与上游逐字节一致（零改动）。
// 任何语言包偏离上游都意味着冲突面回归，必须 FAIL。
console.log('\n=== 语言包是否偏离上游（floccus-via 硬约束：必须零改动）===')
const LOCALE_ZERO_DIFF = ['en', 'zh', 'zh_CN', 'zh-Hans', 'zh_TW']
let localeDirty = false
for (const loc of LOCALE_ZERO_DIFF) {
  const f = path.join(LOCALES, loc, 'messages.json')
  if (!fs.existsSync(f)) continue
  let base = null
  try {
    base = require('child_process')
      .execSync(`git show 944fc3e:_locales/${loc}/messages.json`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
  } catch (e) {
    /* 取不到上游基线就跳过校验，不误报 */
    console.log(`  ? ${loc.padEnd(9)} 取不到上游基线，跳过比对`)
    continue
  }
  const norm = (s) => s.replace(/\r\n/g, '\n').trim()
  const same = norm(base) === norm(fs.readFileSync(f, 'utf8'))
  if (!same) localeDirty = true
  console.log(`  ${same ? '✅' : '❌'} ${loc.padEnd(9)} ${same ? '与上游一致' : '已被改动'}`)
}
if (localeDirty) {
  console.log('  ❌ 有语言包偏离上游。floccus-via 的 Via 文案走 src/ui/via-text.ts，')
  console.log('     不需要改语言包 —— 请把它恢复到上游版本。')
}

process.exitCode = anyMissing || localeDirty ? 1 : 0
