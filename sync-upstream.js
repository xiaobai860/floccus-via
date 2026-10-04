#!/usr/bin/env node
/**
 * 同步上游 floccus 前的「冲突体检」
 *
 * 背景：本项目是 floccus 的 fork，为了兼容 Via 浏览器改了一小撮文件。
 * 上游发新版后，直接 merge 有可能踩到同一行代码。这个脚本会在真正 merge 之前，
 * 把风险点摸清楚并给出分步操作，避免「一 merge 就满屏红」。
 *
 * 用法：
 *   node sync-upstream.js                      只体检，不改仓库
 *   node sync-upstream.js --json               输出 JSON（给别的脚本用）
 *   node sync-upstream.js --upstream <ref>     跟指定 ref 比（默认 origin/develop）
 *
 * 体检分三层，从粗到细：
 *   1) 上游新增了哪些提交、动了哪些文件
 *   2) 我这版改动碰到的文件里，哪些被上游同样碰过（人工判断区）
 *   3) git merge-tree 真实 dry-run，直接报出会冲突的文件（权威结论）
 */

const { execSync } = require('child_process')
const fs = require('fs')

const REMOTE = 'origin'
const BASE_BRANCH = 'develop'
const UPSTREAM = `${REMOTE}/${BASE_BRANCH}`

/** 我为了 Via 兼容改动的全部文件（相对仓库根） */
const VIA_PATCH_FILES = [
  // Via 插槽本体：纯新增文件，上游没有，永远不会起冲突，列在这里只是为了体检时
  // 如果它真被改了（多半是误操作或手滑 merge），能立刻被盯上。
  'src/lib/serializers/HtmlVia.ts',
  // Html.ts 只剩 6 个 VIA-HOOK，via 逻辑已抽到 HtmlVia.ts，风险中等（见下方 RISK_MAP）
  'src/lib/serializers/Html.ts',
  'src/lib/adapters/WebDav.ts',
  'src/lib/Tree.ts',
  'src/lib/native/I18n.ts',
  'src/ui/components/OptionsWebdav.vue',
  'manifest.json',
  'html/background.html',
  'html/options.html',
  '_locales/en/messages.json',
  '_locales/zh/messages.json',
  '_locales/zh_CN/messages.json',
  '_locales/zh-Hans/messages.json',
  '_locales/zh_TW/messages.json',
]

/**
 * fork 专属文件：上游 floccus 里不存在这些名字
 * ─────────────────────────────────────────────────────────────────────────────
 * 它们不可能跟上游起冲突，但要防的是「被人手滑删掉 / 误 merge 时当成垃圾清掉」。
 * 脚本启动时会逐个校验存在性，少一个就立刻报警。
 */
const VIA_PROTECTED_FILES = [
  'README.md', // ★ fork 门面：GitHub 仓库首页文档，靠 .gitattributes 的 keep-ours 锁住不被上游覆盖
  'README.upstream.md', // 上游 README 的归档副本（fork 专属，上游没有这个文件）
  'README.via.md', // ★ 本文档：fork 的维护说明，绝不能被覆盖或删掉
  'src/lib/serializers/HtmlVia.ts', // Via 插槽本体
  'audit-extension.js',
  'check-i18n.js',
  'check-official-compat.js',
  'check-zip.js',
  'pack-for-edge.js',
  'pack-for-chrome.js',
  'sync-upstream.js', // 别人跑体检时要能找到它
  'src/entries/via-check.js',
  'src/entries/official-compat.js',
  'webpack.via-check.js',
  'webpack.official-check.js',
]

/** 我改动但「上游大概率也会动」的文件 —— 冲突高发区，单独提醒 */
const HIGH_RISK = new Set([
  // 上游改 serialize/parse 主体 = 书签树全乱。注意 Html.ts 现在只剩 6 个 VIA-HOOK，
  // 真正要看的是"上游有没有大改序列化器"，而不是我们那几行。
  'src/lib/serializers/Html.ts',
  'src/lib/adapters/WebDav.ts', // 上游改适配器 = 同步流程改动
  'src/ui/components/OptionsWebdav.vue', // 上游改设置页 = 选项卡冲突
  '_locales/en/messages.json', // 上游加新文案 = 必备
  '_locales/zh/messages.json',
  '_locales/zh_CN/messages.json',
  '_locales/zh-Hans/messages.json',
  '_locales/zh_TW/messages.json',
])

/**
 * 合并后的人肉确认清单。README.via.md 第十一章是它的详细说明，这里保持一一对应，
 * 让脚本每次跑完把「同步后到底该看什么」直接怼到控制台上，别只躺在文档里。
 */
const POST_SYNC_CHECKLIST = [
  ['P0 必跑', 'npx gulp build', 'TS 编译'],
  ['P0 必跑', 'node check-official-compat.js', '官方格式对等，sha 必须 33ea98f5… / 39147 字节'],
  ['P0 必跑', 'node check-i18n.js', '中文四包缺 0'],
  ['P0 必跑', 'node check-zip.js', 'zip 合规（176 条目 CRC）'],
  ['P0 必跑', 'node audit-extension.js', '33 PASS / 0 FAIL'],
  ['P0 必跑', 'node pack-for-edge.js', '重新打 ../floccus-via 与 zip'],
  ['P1 必查', "grep -n VIA-HOOK src/lib/serializers/Html.ts", '必须仍是 6 个，顺序别乱'],
  ['P1 必查', 'git diff origin/develop -- src/lib/murmurhash3.ts', '必须为空！Via 稳定 ID 依赖它，动了会全量重建'],
  ['P1 必查', 'grep -n tabGroups manifest.json', '必须在，我们补的权限别被冲掉'],
  ['P1 必查', 'src/lib/adapters/WebDav.ts 的 via_compatible / via_root_folder 与 getHtmlSerializerOptions() 短路', '缺了等于不开 Via 也走兼容路径'],
  ['P1 必查', 'src/ui/components/OptionsWebdav.vue 的 Via 卡片还在不在', '上游改设置页会被冲掉'],
  ['P1 必查', 'src/lib/native/I18n.ts 的 getMessageChain 与 zh-Hans 借道', '缺了 Via 新文案会露英文'],
  ['P1 必查', 'src/lib/adapters/Caching.ts 还能不能挂 viaRootName', '重构缓存会让 Via 根文件夹识别失效'],
  ['P2 顺手', 'git status 里 android/ios 那 8 个 M', '纯行尾噪声，别 add，别用 git add -A'],
  ['P2 顺手', 'floccus-via.zip / .crx / key.pem', '本地产物与私钥，一律不提交'],
  ['P2 顺手', 'git diff README.upstream.md', '上游 README 的归档，变了说明上游更新了说明文档'],
]

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

/**
 * 上游 README 归档检查（README.upstream.md）
 *
 * 根 README.md 是我们的中文门面，被 .gitattributes 的 merge=keep-ours 锁死，
 * 上游改 README 不会跑到首页上来。但「上游 README 更新了」这件事本身得让我们知道，
 * 所以把它单独归档成 README.upstream.md（fork 专属文件，上游没有，merge 不会碰）。
 *
 * 默认只体检不写文件；带 --archive-readme 才真正更新归档。
 */
function checkUpstreamReadme(upRef, doWrite) {
  const TARGET = 'README.upstream.md'
  let upstream
  try {
    upstream = run(`git show ${upRef}:README.md`)
  } catch (e) {
    return { exists: false, changed: false, applied: false }
  }
  if (!upstream || !upstream.trim()) return { exists: false, changed: false, applied: false }

  // ⚠️ 行尾归一化：上游 blob 是 LF，而本机 core.autocrlf=true 会把归档文件落成 CRLF，
  //    直接字符串比会永远判定「变了」，每次同步都误报。两边都吃掉 \r 再比。
  const norm = (s) => s.replace(/\r\n/g, '\n')
  const archived = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : ''
  const changed = norm(upstream) !== norm(archived)
  if (changed && doWrite) {
    // 原样写（LF），配合 .gitattributes 的 -text 保证跨机器 git status 都干净
    fs.writeFileSync(TARGET, upstream, 'utf8')
    return { exists: true, changed: true, applied: true }
  }
  return { exists: true, changed, applied: false }
}

function main() {
  const asJson = process.argv.includes('--json')

  // 0. 保护文件在不在（fork 专属，上游没有，真少一个只能是误操作）
  const missing = VIA_PROTECTED_FILES.filter((f) => !fs.existsSync(f))
  if (missing.length) {
    console.log('⛔ fork 专属文件缺失，先处理再继续：')
    missing.forEach((f) => console.log('   ' + f))
    console.log('    README.via.md 是本次同步的说明文档，删了就没了（fork 的 my-viasync 分支上有副本）。')
  } else {
    console.log(`→ fork 专属文件 ${VIA_PROTECTED_FILES.length} 个，全部在位。`)
  }

  // 0.5 origin 归属校验
  // fork 的默认分支已设为 my-viasync，所以更可能有人把 origin 直接指到自己的 fork。
  // 那样 origin/develop 就变成「上游原版」而不是「我们的最新版」，
  // 而我们本就在 develop 上 → head === up → 脚本会判定「完全一致，没有新提交」直接退出，
  // 静默退化成空操作，最难察觉。所以这里必须挡住。
  try {
    const originUrl = run('git remote get-url origin').trim()
    const isUpstream = /floccusaddon\/floccus/i.test(originUrl)
    const isSelfFork = /xiaobai860\/floccus-via/i.test(originUrl)
    if (isUpstream) {
      console.log(`→ origin 指向上游 floccusaddon/floccus，引用 ${UPSTREAM} 正确。`)
    } else if (isSelfFork) {
      console.log('⛔ origin 指向自己的 fork，不是上游！同步会静默失效，先修：')
      console.log(`   当前 origin = ${originUrl}`)
      console.log('   git remote set-url origin https://github.com/floccusaddon/floccus.git')
      console.log('   git remote set-url fork  https://github.com/xiaobai860/floccus-via.git')
    } else {
      console.log(`⚠️ origin 指向意料之外的地址，请人工确认是不是上游：${originUrl}`)
    }
  } catch (e) {
    console.log('（读不到 origin 地址，跳过归属校验）')
  }

  const upIdx = process.argv.findIndex(
    (a, i) => a === '--upstream' && process.argv[i + 1]
  )
  const upEq = (process.argv.find((a) => a.startsWith('--upstream=')) || '').split('=')[1]
  const upArg = upIdx >= 0 ? process.argv[upIdx + 1] : upEq
  const UPSTREAM_REF = upArg || UPSTREAM
  const report = { upstream: {}, risk: [], conflicts: [], notes: [] }

  // 1. 拉最新
  console.log('→ 拉取上游最新…')
  if (!upArg) run(`git fetch ${REMOTE} --quiet`)
  const head = run('git rev-parse HEAD').trim()
  const up = run(`git rev-parse ${UPSTREAM_REF}`).trim()
  report.upstream = { head, upstream: up, ahead: false, newCommits: [] }

  if (head === up) {
    console.log(`\n本地与上游 ${BASE_BRANCH} 完全一致（${head.slice(0, 7)} v5.11.1）。`)
    console.log('上游还没有新提交，先别急。要更新就等 floccus 发新版后再跑一次本脚本。')
    if (asJson) console.log(JSON.stringify(report, null, 2))
    return 0
  }

  const range = `${head}..${up}`
  const commits = run(`git log --oneline ${range}`).trim().split('\n').filter(Boolean)
  const touched = new Set(
    run(`git diff --name-only ${range}`)
      .trim()
      .split('\n')
      .filter(Boolean)
  )
  report.upstream = { head, upstream: up, ahead: true, newCommits: commits }

  console.log(`\n上游有新提交 ${commits.length} 个：`)
  commits.forEach((c) => console.log('   ' + c))

  console.log(`\n上游本次改动文件 ${touched.size} 个：`)
  ;[...touched].forEach((f) => console.log('   ' + f))

  // 2. 我改过的文件里，哪些被上游同时碰过
  console.log('\n=== 改动面体检 ===')
  const overlap = VIA_PATCH_FILES.filter((f) => touched.has(f))
  report.risk = VIA_PATCH_FILES.map((f) => ({
    file: f,
    touchedByUpstream: touched.has(f),
    level: touched.has(f) ? (HIGH_RISK.has(f) ? 'high' : 'medium') : 'safe',
  }))

  if (!overlap.length) {
    console.log('✅ 我改过的文件，上游一个都没碰 → 直接 merge，改动原样保留。')
  } else {
    console.log('⚠️  以下文件两边都改了，需要手动看一眼：')
    overlap.forEach((f) => {
      const tag = HIGH_RISK.has(f) ? '高（优先看）' : '中（多为文案/版本号）'
      console.log(`   ${f}  [${tag}]`)
    })
    console.log('\n提示：这些文件里，除了 Via 分支以外的内容基本都是上游自己的改动，')
    console.log('      merge 时只保留「viaCompatible / stableId / 中文文案」这几处即可。')
  }

  // 3. 语言包专项：上游加新文案 → 中文包会缺，必须补
  const localeUpstream = [...touched].filter((f) => f.startsWith('_locales/'))
  const localeMine = VIA_PATCH_FILES.filter((f) => f.startsWith('_locales/'))
  if (localeUpstream.length && localeMine.length) {
    const note =
      `上游动了 ${localeUpstream.length} 个语言包，我这边也补过中文。` +
      '合并后务必跑 node check-i18n.js，中文包缺口会暴露出来。'
    report.notes.push(note)
    console.log('\n📌 语言包提示：' + note)
  }

  // 3.5 上游 README 归档体检
  // README.md 被 .gitattributes 的 keep-ours 锁死，上游改 README 不会顶掉我们的门面；
  // 但「上游 README 更新了」这件事得知道，所以拿上游版本跟 README.upstream.md 比一下。
  const archiveWrite = process.argv.includes('--archive-readme')
  const rd = checkUpstreamReadme(UPSTREAM_REF, archiveWrite)
  if (rd.exists) {
    if (rd.changed) {
      if (rd.applied) {
        console.log('\n📌 上游 README 有更新，已同步进 README.upstream.md（归档已刷新）。')
      } else {
        const note =
          '上游 README 更新了，但我们的首页是中文导引卡（keep-ours 锁住，不会被覆盖）。' +
          '要跟上游改动就跑 node patch-readme-head.js --refresh，或先 node sync-upstream.js --archive-readme 只更新归档。'
        report.notes.push(note)
        console.log('\n📌 ' + note)
      }
    } else {
      console.log('\n📌 上游 README 与归档一致（README.md 仍走 keep-ours，无需处理）。')
    }
  }

  // 4. merge-tree dry-run：git 会提前把真冲突文件列出来
  console.log('\n=== 冲突预演（merge dry-run）===')
  let conflicted = []
  try {
    const out = run(
      `git merge-tree --write-tree --merge-base=${head} ${head} ${up}`
    )
    const lines = out.trim().split('\n')
    conflicted = lines.filter((l) => l.includes('CONFLICT')).map((l) => l.trim())
    if (!conflicted.length) {
      console.log('✅ 无冲突，可以放心 git merge ' + UPSTREAM_REF)
    } else {
      console.log(`⚠️  预计 ${conflicted.length} 处冲突：`)
      conflicted.forEach((l) => console.log('   ' + l.replace(/^CONFLICT \(content\): Merge conflict in /, '')))
    }
  } catch (e) {
    const msg = String(e.stdout || e.message || '').trim()
    conflicted = msg
      .split('\n')
      .filter((l) => l.includes('CONFLICT'))
      .map((l) => l.trim())
    if (conflicted.length) {
      console.log(`⚠️  预计 ${conflicted.length} 处冲突：`)
      conflicted.forEach((l) => console.log('   ' + l.replace(/^CONFLICT \(content\): Merge conflict in /, '')))
    } else {
      console.log('（本机 git 不支持 merge-tree，跳过预演，直接看上面的改动面体检即可）')
    }
  }
  report.conflicts = conflicted

  // 5. 收尾动作清单（与 README.via.md 第十一章一一对应）
  console.log('\n=== 合并后要跑的（顺序别乱）===')
  console.log(`git merge ${UPSTREAM_REF}    # 想保住提交历史就用 git rebase ${UPSTREAM_REF}`)
  console.log('\n--- 同步后确认清单（照着过一遍）---')
  let cur = ''
  POST_SYNC_CHECKLIST.forEach(([tag, cmd, why]) => {
    if (tag !== cur) {
      console.log(`\n[${tag}]`)
      cur = tag
    }
    console.log('  · ' + cmd)
    console.log('      → ' + why)
  })
  console.log('\n完整说明见 README.via.md 第十一章《同步上游后的验收清单》。')
  console.log('注意：VIA_FILE / FLOCCUS_FILE 两个环境变量指向真实书签文件，否则回归脚本会崩。')

  if (asJson) console.log('\n' + JSON.stringify(report, null, 2))
  return overlap.length ? 0 : 0
}

process.exit(main())
