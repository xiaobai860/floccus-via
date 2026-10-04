/**
 * Via 兼容层（纯新增模块，不改动上游任何控制流）
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 这一整个文件都是「挂」在官方 Html 序列化器上的 Via 兼容实现，
 * 官方 `serializers/Html.ts` 里只留几个可选参数 + `if (viaCompatible)` 的转发。
 * 这么拆的用意：同步上游 floccus 时，上游几乎不可能动这个文件（上游原本没有它），
 * 于是冲突面被压到 Html.ts 里那几个 hook 点上，而不是这 200 行逻辑。
 *
 * Via 兼容模式改变序列化器的两处行为：
 *
 * 1) 解析：识别 Via 浏览器导出的「单一根包装文件夹」形态（坚果云里那份 bookmarks.html
 *    的第一层是 <H3>一加5</H3>）。官方版 getRootFolder() 只认 personal_toolbar_folder /
 *    folded / item_id / Mozilla Firefox 这几种标记，认不出 Via 这种写法，于是 Via 的
 *    书签在 floccus 眼里路径是 /一加5/手机应用/x，电脑上是 /Bookmarks Bar/导航页/y，
 *    两边层层对不上；这里把它拍平，让手机端顶层文件夹和电脑端顶层文件夹处在同一层级。
 *
 * 2) 输出：写出完整的 Netscape 文件头 + ADD_DATE，并且不写 floccus 私有的 ID / TAGS
 *    属性（Via 的导出里本来就没有这些），让 Via 能像读自己的备份一样读我们的输出。
 *
 * 另外，Via 每次重传文件都会抹掉 floccus 写进去的 ID 和最高 ID 注释，而官方版解析时
 * 对没有 ID 的节点用自增计数器临时编号——每轮同步编号都从 1 重新开始，映射表全部失效，
 * 同一条书签被反复当成「新数据」重复添加。这就是「越同步越乱」的主因。
 * 下面 stableId() 用「父路径 + 标题 + 地址」派生一个哈希 ID 顶替，只要路径不变
 * 它就不变，映射表得以稳定。
 */
import * as cheerio from 'cheerio'
import { murmurhash3_32_gc } from '../murmurhash3'

export interface IHtmlSerializerOptions {
  /** 按 Via / 原生 Netscape 格式读写 */
  viaCompatible?: boolean
  /** Via 模式输出时用的根文件夹名；留空表示不额外包一层 */
  rootFolderName?: string
}

export const DEFAULT_OPTIONS: IHtmlSerializerOptions = { viaCompatible: false }

/** Via / 原生 Netscape 文件的完整头 */
export const NETSCAPE_HEADER = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`

const ID_SEED_A = 0x5eeda11
const ID_SEED_B = 0x5eedb22

/** 根包装文件夹（写回文件时那层）的 ADD_DATE 用它做 key */
export const ROOT_DATE_KEY = '__floccus_via_root__'

/** stableId -> { date: ADD_DATE, stamp: 本次写入时间（用于过期清理） } */
const dateAddedCache = new Map<string, { date: number, stamp: number }>()
/** 最近一次解析到的根包装文件夹名，序列化时兜底用（只在 via 模式读写） */
let lastRootFolderName = ''

const DATE_CACHE_TTL = 6 * 60 * 60 * 1000

export const rememberDateAdded = (id: string, date: number) => {
  dateAddedCache.set(id, { date, stamp: Date.now() })
  if (dateAddedCache.size > 20000) {
    const cutoff = Date.now() - DATE_CACHE_TTL
    for (const [key, value] of dateAddedCache) {
      if (value.stamp < cutoff) dateAddedCache.delete(key)
    }
  }
}

export const getDateAdded = (id: string, fallback: number) => {
  const entry = dateAddedCache.get(id)
  return entry ? entry.date : fallback
}

/** Html.deserialize 每次解析都调它重置兜底值，防止上一个账号的根名残留 */
export const setLastRootFolderName = (name: string) => {
  lastRootFolderName = name
}

export const getLastRootFolderName = () => lastRootFolderName

export const stableId = (parentId: string | number, title: string, url: string) => {
  // 分隔符写的是转义序列 \u0000（真实值覆盖见下方替换），不能存真 NUL 字节：
  // 真 NUL 会让 git 把整个文件当二进制、diff 退化成一次整体替换（见 README）。
  // 另外改分隔符 ≈ 改哈希 → 所有已同步书签的映射表失效，不要动。
  const key = `${parentId}\u0000${title}\u0000${url}`
  return (
    'v' +
    murmurhash3_32_gc(key, ID_SEED_A).toString(16) +
    murmurhash3_32_gc(key, ID_SEED_B).toString(16)
  )
}

/**
 * 同级重名时的派生 ID：把出现序号混进 title 再哈希，避免两条同名文件夹撞成同一个 ID。
 * index 为空表示不掺序号（这样用户手动调整顺序不会让 ID 变动）。
 * 抽到这里的另一个好处：Html.ts 里不用再出现 NUL 字面量，少一处和上游对齐时的坑。
 */
export const deriveViaId = (parentId: string | number, title: string, index?: number) => {
  const key = index === undefined ? title : `${title}\u0000${index}`
  return stableId(parentId || '', key, '')
}

/** 属性值转义，输出标准 HTML 命名实体 */
export const attrEncode = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** 文本节点转义 */
export const textEncode = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * Via 导出的文件把整棵树包在一个根文件夹里（<DL><p><DT><H3>名字</H3><DL><p>...）。
 * 只有当根层恰好只有一个 DT、且它唯一的子元素是 H3（文件夹）并且自带子 DL 时，
 * 才判定为这种形态——Chrome「书签栏 / 其他书签 / 移动设备」是多个 DT，不会误判。
 */
export const findSingleRootFolder = (rootDL: cheerio.Cheerio<any>) => {
  const dts = rootDL.children('dt')
  if (dts.length !== 1) return null
  const dt = dts.eq(0)
  const first = dt.children().eq(0)
  if (!first.length || first[0].name !== 'h3') return null
  const dl = dt.children('dl').first()
  if (!dl.length) return null
  return { dl, title: first.text(), date: parseInt(first.attr('add_date'), 10) }
}
