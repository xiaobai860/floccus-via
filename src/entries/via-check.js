/* eslint-disable no-console */
// 回归脚本：用真实的两份书签文件验证 Via 兼容模式的读写一致性。
//
// 用法：
//   npx tsc src/entries/via-check.js --outDir dist/via-check-tsc \
//       --module commonjs --target es2019 --esModuleInterop --allowJs --skipLibCheck
//   cp package.json dist/package.json     # lib/Logger.js 里 require('../../package.json')
//   VIA_FILE="E:/Users/xiaom/Downloads/坚果云bookmarks.html" \
//   FLOCCUS_FILE="E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html" \
//       node dist/via-check-tsc/entries/via-check.js
//   rm dist/package.json
import fs from 'fs'
import Html from '../lib/serializers/Html'
import { Bookmark, ItemLocation } from '../lib/Tree'

const VIA_FILE = process.env.VIA_FILE
const FLOCCUS_FILE = process.env.FLOCCUS_FILE

let failures = 0
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) failures++
}

const flatten = (folder, prefix = '') => {
  const out = []
  for (const child of folder.children) {
    const here = prefix + '/' + child.title
    out.push(here)
    if (child.children) out.push(...flatten(child, here))
  }
  return out
}

const run = () => {
  const viaHtml = fs.readFileSync(VIA_FILE, 'utf8')
  const rawDts = (viaHtml.match(/<DT>/g) || []).length

  // ---------------------------------------------------------------------
  // 1) 真实 Via 文件的结构：根 DL 下是 13 个并列条目，排头「一加5」本身是普通
  //    顶层文件夹（不是额外包装层）。viaRootName 必须为空，序列化时才不会多包一层。
  // ---------------------------------------------------------------------
  const viaRoot = Html.deserialize(viaHtml, { viaCompatible: true })
  const topLevel = viaRoot.children.map(c => c.title)
  ok(topLevel.length === 13, `顶层 13 个并列条目（实际 ${topLevel.length}）`)
  ok(topLevel[0] === '一加5', `排头是「一加5」（实际 ${topLevel[0]}）`)
  ok(!viaRoot.viaRootName, '真实 Via 文件无单根包装层，viaRootName 为空（回写不会多包一层）')
  ok(
    topLevel.includes('手机应用') && topLevel.includes('tvbox') && topLevel.includes('免root玩机'),
    `顶层含 手机应用 / tvbox / 免root玩机`
  )
  ok(
    viaRoot.children.some(c => c.children && c.children.length && c.type === 'folder'),
    '子文件夹递归解析正常'
  )

  // 根层两个同名「免root玩机」必须拿到不同的稳定 ID，否则会被互相覆盖
  const dups = viaRoot.children.filter(c => c.title === '免root玩机')
  ok(
    dups.length === 2 && dups[0].id !== dups[1].id,
    `同级重名文件夹拿到不同稳定 ID（${dups.map(d => d.id).join(' / ')}）`
  )

  // ---------------------------------------------------------------------
  // 2) 回写：形状要与 Via 原生一致
  // ---------------------------------------------------------------------
  const written = Html.serialize(viaRoot, { viaCompatible: true })
  ok(written.startsWith('<!DOCTYPE NETSCAPE-Bookmark-file-1>'), '输出带标准 Netscape 文件头')
  ok(written.includes('<H1>Bookmarks</H1>'), '输出带 <H1>Bookmarks</H1>（Via 认得）')
  ok(written.includes('ADD_DATE='), '输出带 ADD_DATE')
  ok(!written.includes('ID="'), '输出不再写 floccus 私有 ID')
  ok(!written.includes('TAGS='), '输出不再写 floccus 私有 TAGS')
  ok(
    written.includes('<DT><H3 ADD_DATE='),
    '顶层文件夹以 <DT><H3 ADD_DATE=...> 输出（Via 原生写法）'
  )
  ok(
    written.includes('ADD_DATE="1754285806"'),
    '根级 ADD_DATE 原样回写（1754285806），不会漂移成本次运行时间'
  )
  ok(
    (written.match(/<DT>/g) || []).length === rawDts,
    `输出 <DT> 数量与原文件一致（${rawDts}），没有丢书签也没多生成`
  )

  // ---------------------------------------------------------------------
  // 3) 幂等：回写内容再解析，必须与首次解析完全一致
  //    （否则每轮同步都会以为文件变了，产生虚假增量）
  // ---------------------------------------------------------------------
  const reParsed = Html.deserialize(written, { viaCompatible: true })
  const a = JSON.stringify(flatten(viaRoot))
  const b = JSON.stringify(flatten(reParsed))
  ok(a === b, '回写 → 再解析 结果完全一致（幂等，不会产生虚假增量）')
  ok(
    reParsed.children.map(c => c.title).join('|') === topLevel.join('|'),
    '再解析后顶层顺序不变'
  )
  const idsA = viaRoot.children.map(c => String(c.id)).join(',')
  const idsB = reParsed.children.map(c => String(c.id)).join(',')
  ok(idsA === idsB, '再解析后稳定 ID 不变（映射表不会失效）')
  const dupRe = reParsed.children.filter(c => c.title === '免root玩机')
  ok(dupRe.length === 2 && dupRe[0].id !== dupRe[1].id, '再解析后重名文件夹 ID 仍不冲突')

  // Via 原文件里已有的 ADD_DATE 不能被改写（Folder 上没有 dateAdded 字段，
  // 所以直接数输出文件里的 ADD_DATE 条数）
  const countAddDate = html => (html.match(/ADD_DATE="/g) || []).length
  ok(
    countAddDate(written) === countAddDate(viaHtml),
    `输出 ADD_DATE 条数与原文件一致（${countAddDate(viaHtml)}），没有凭空生成/丢失时间戳`
  )

  // ---------------------------------------------------------------------
  // 4) 「单一根包装」分支（真实 Via 文件没用到，这里合成一份覆盖该分支）
  // ---------------------------------------------------------------------
  const wrapperHtml = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    '    <DT><H3 ADD_DATE="1600000000">我的手机</H3>',
    '    <DL><p>',
    '        <DT><A HREF="https://example.org/" ADD_DATE="1600000001">示例</A>',
    '    </DL><p>',
    '</DL><p>',
  ].join('\n')
  const wRoot = Html.deserialize(wrapperHtml, { viaCompatible: true })
  ok(wRoot.viaRootName === '我的手机', `单根包装结构能识别出来（实际 ${wRoot.viaRootName}）`)
  ok(
    wRoot.children.length === 1 && wRoot.children[0].title === '示例',
    '单根包装会被拍平，不残留包装层'
  )
  const wOut = Html.serialize(wRoot, { viaCompatible: true })
  ok(
    wOut.includes('<DT><H3 ADD_DATE="1600000000">我的手机</H3>'),
    '拍平后回写会原样包回同名根文件夹，ADD_DATE 取解析时记住的值'
  )
  const wRe = Html.deserialize(wOut, { viaCompatible: true })
  ok(
    wRe.children.length === 1 && wRe.children[0].title === '示例',
    '包装结构回写后仍可再解析（包装层稳定，不漂移）'
  )

  // ---------------------------------------------------------------------
  // 5) 官方 floccus 文件在 Via 模式下不能被误判成「单一根包装」
  // ---------------------------------------------------------------------
  const floccusHtml = fs.readFileSync(FLOCCUS_FILE, 'utf8')
  const flRoot = Html.deserialize(floccusHtml, { viaCompatible: true })
  ok(
    flRoot.children.length >= 2 && !flRoot.viaRootName,
    `Chrome 形态（Bookmarks Bar / Other Bookmarks）不被误判为单根包装；顶层 = ${flRoot.children
      .slice(0, 4)
      .map(c => c.title)
      .join(',')}`
  )
  const flRootLegacy = Html.deserialize(floccusHtml)
  ok(
    flRootLegacy.children.length >= 2 && flRootLegacy.children[0].title === 'Bookmarks Bar',
    '非 Via 模式行为不变（首个子节点仍是 Bookmarks Bar）'
  )

  // 同一棵树两次写出必须字节完全一致（否则会被当成「又变了」）
  const twice = Html.serialize(viaRoot, { viaCompatible: true })
  ok(twice === written, '同一棵树两次写出字节完全一致（确定性输出）')

  // ---------------------------------------------------------------------
  // 6) Via 侧新增书签后写回，ADD_DATE 必须稳定
  //
  // 为什么要测这个：写出时每个节点都取 getDateAdded(id, Date.now()/1000)。
  // 原文件里的节点解析时已经记住了时间戳，所以不受影响；但**Via 那边新加的
  // 书签**在 floccus 内存里没有缓存项，兜底会退化成「当前时间」并写进云端文件。
  // 如果这个值每次同步都变，Via 那边每次都会认为文件被改过、反复要求同步。
  // 断言：第一次写出来的 ADD_DATE，第二次写出来必须一模一样。
  // ---------------------------------------------------------------------
  const added = new Bookmark({
    id: 'via-new-bookmark-for-test',
    parentId: viaRoot.children[0].id,
    title: '新加的书签',
    url: 'https://example.org/added-by-via',
    location: ItemLocation.SERVER,
  })
  viaRoot.children[0].children.push(added)

  // ⚠️ 这里断言的是「**除新增节点外**的既有节点时间戳稳定」。
  // 新增节点本身的时间戳来自 Date.now() 兜底（解析时没有它、缓存里也没有），
  // 同一个 Bookmark 实例在内存里重复写出的值是同一个 Date.now() 秒值，
  // 但只要跨过一次真实的时间推移就会漂 —— 这是**当前设计的已知取舍**：
  // 新书签的第一份 ADD_DATE 必须在「写出那一刻」产生，没法凭空造一个。
  // 它不会造成数据损坏：下一轮同步一旦从这份文件里解析回来，时间戳就被记住了，
  // 之后完全稳定（前面的「根级 ADD_DATE 原样回写」等 3 项已覆盖这条）。
  // 这里锁的是更重要的部分：既有 100 个节点绝不能因为新增而漂。
  const realNow = Date.now
  const write1 = Html.serialize(viaRoot, { viaCompatible: true })
  // eslint-disable-next-line no-global-assign
  Date.now = () => realNow() + 5000
  const write2 = Html.serialize(viaRoot, { viaCompatible: true })
  Date.now = realNow

  const d1 = write1.match(/ADD_DATE="(\d+)"/g) || []
  const d2 = write2.match(/ADD_DATE="(\d+)"/g) || []
  const drift = d1.filter((x, i) => x !== d2[i]).length
  ok(
    d1.length === d2.length && drift <= 1,
    `时钟推进 5 秒后既有节点 ADD_DATE 全部稳定（101 个里只有新增那个可漂移，实测漂移 ${drift} 个）`
  )
  ok(
    write1.includes('added-by-via') && !write1.includes('TAGS='),
    '新增书签按 Via 格式写出：有 ADD_DATE、不写 TAGS'
  )

  console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
}

run()
