import Serializer from '../interfaces/Serializer'
import { Bookmark, Folder, ItemLocation, TItem } from '../Tree'
import * as cheerio from 'cheerio'
// Via 兼容层的全部逻辑（哈希稳定 ID、ADD_DATE 缓存、根包装识别、文件头、转义）
// 都放在这个纯新增模块里，本文件只保留下面几个 hook 点。
// 上游 floccus 原本没有 HtmlVia.ts，所以同步上游时它不会和上游代码冲突。
import {
  DEFAULT_OPTIONS,
  IHtmlSerializerOptions,
  NETSCAPE_HEADER,
  ROOT_DATE_KEY,
  deriveViaId,
  findSingleRootFolder,
  getDateAdded,
  getLastRootFolderName,
  rememberDateAdded,
  setLastRootFolderName,
  attrEncode,
  textEncode,
} from './HtmlVia'

// 保持对外类型导出不变（WebDav 等调用方按名字引用）
export type { IHtmlSerializerOptions }

/**
 * ★ 同步上游前先看这里 ★
 *
 * 本文件对上游的改动只有下面标了 VIA-HOOK 的 6 处，其余全是官方原代码。
 * 所有 Via 业务逻辑（稳定哈希 ID、ADD_DATE 记忆、根包装识别、Via 文件头、转义）
 * 都在同目录的 HtmlVia.ts 里——那是纯新增文件，上游没有，永远不会起冲突。
 *
 * 合并上游时如果某个 VIA-HOOK 点和上游新代码撞了，只有两种要处理的情形：
 *   1) 上游改了函数签名 → 把我们的可选参数合并回去即可（默认值仍是不传=官方行为）；
 *   2) 上游改了渲染/解析主体 → 看我们的分支还能不能并排保留。
 * 除了这 6 处之外的任何冲突，直接接受上游版本，别去动 Via 逻辑。
 */

class HtmlSerializer implements Serializer {
  /* VIA-HOOK 1/6 参数新增：官方原本是 serialize(folder)。不传 options 时行为与官方一致。 */
  serialize(folder, options: IHtmlSerializerOptions = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const body = this._serializeFolder(folder, '', opts)

    if (opts.viaCompatible) {
      const name = opts.rootFolderName || getLastRootFolderName()
      if (name) {
        // 根包装文件夹的 ADD_DATE 必须从解析时记住的那个值取，不能回退成「当前时间」，
        // 否则每次同步写出的字节都不一样，Via 那边每次都会以为文件变了。
        const date = getDateAdded(ROOT_DATE_KEY, Math.floor(Date.now() / 1000))
        const inner = this._serializeFolder(folder, '  ', opts)
        // 复刻 Via 导出的形状：整个树再包一层根文件夹
        return (
          NETSCAPE_HEADER +
          `  <DT><H3 ADD_DATE="${date}">${textEncode(name)}</H3>\n` +
          `  <DL><p>\n${inner}  </DL><p>\n` +
          `</DL><p>\n`
        )
      }
      return NETSCAPE_HEADER + body + `</DL><p>\n`
    }

    return `<DL><p>\n${body}</DL><p>\n`
  }

  _htmlentities_encode(string) {
    return string.replace(/[<>&"']/g, char => '&#' + char.charCodeAt(0) + ';')
  }

  /* VIA-HOOK 2/6 书签行 / 文件夹行的 Via 分支。两种格式的结构一样，只是属性不同：
     官方 `ID="x" TAGS="y"` ↔ Via `ADD_DATE="d"`（文件夹行补 ADD_DATE）。 */
  _serializeFolder(folder, indent, options: IHtmlSerializerOptions = {}) {
    const via = Boolean(options.viaCompatible)
    return folder.children
      .map(child => {
        if (child instanceof Bookmark) {
          if (via) {
            const date = getDateAdded(String(child.id), Math.floor(Date.now() / 1000))
            const tags = (child.tags || []).join(',')
            return (
              `${indent}<DT><A HREF="${attrEncode(child.url)}" ADD_DATE="${date}"` +
              (tags ? ` TAGS="${attrEncode(tags)}"` : '') +
              `>${textEncode(child.title)}</A>\n`
            )
          }
          return (
            // Netscape's TAGS attribute is comma separated; Nextcloud Bookmarks
            // picks it up on import, so bulk imports don't lose their tags.
            `${indent}<DT><A HREF="${this._htmlentities_encode(child.url)}" TAGS="${this._htmlentities_encode(
              (child.tags || []).join(',')
            )}" ID="${child.id}">${this._htmlentities_encode(child.title)}</A>\n`
          )
        } else if (child instanceof Folder) {
          const nextIndent = indent + '  '
          const inner = this._serializeFolder(child, nextIndent, options)
          if (via) {
            const date = getDateAdded(String(child.id), Math.floor(Date.now() / 1000))
            return (
              `${indent}<DT><H3 ADD_DATE="${date}">${textEncode(child.title)}</H3>\n` +
              `${indent}<DL><p>\n${inner}${indent}</DL><p>\n`
            )
          }
          return (
            `${indent}<DT><H3 ID="${child.id}">${this._htmlentities_encode(child.title)}</H3>\n` +
            `${indent}<DL><p>\n${inner}${indent}</DL><p>\n`
          )
        }
      })
      .join('')
  }

  /* VIA-HOOK 3/6 参数新增 + 每次解析重置根名兜底（否则上一份文件的根名会串到下一棵无关的树上）。 */
  deserialize(html, options: IHtmlSerializerOptions = {}): Folder<typeof ItemLocation.SERVER> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const { items, rootName } = parseByString(html, opts)
    items.forEach(f => { f.parentId = '0' })
    // 每次解析都重置这个兜底值：否则上一个账号 / 上一个文件读到的根名会残留，
    // 让 serialize 给一棵无关的树错误地包上别人的根文件夹。
    setLastRootFolderName(rootName || '')
    if (rootName) {
      const root = new Folder({
        id: '0',
        title: 'root',
        children: items,
        location: ItemLocation.SERVER,
        isRoot: true,
      })
      root.viaRootName = rootName
      return root
    }
    return new Folder({
      id: '0',
      title: 'root',
      children: items,
      location: ItemLocation.SERVER,
      isRoot: true,
    })
  }
}

export default new HtmlSerializer()

// The following code is based on https://github.com/hold-baby/bookmark-file-parser
// Copyright (c) 2019 hold-baby
// MIT License

export const getRootFolder = (body: cheerio.Cheerio<any>) => {
  const h3 = body.find('h3').first()

  const isChrome = typeof h3.attr('personal_toolbar_folder') === 'string'

  if (isChrome) {
    return body.children('dl').first()
  }

  const isSafari = typeof h3.attr('folded') === 'string'

  if (isSafari) {
    return body
  }

  const isIE = typeof h3.attr('item_id') === 'string'

  if (isIE) {
    return body.children('dl').first()
  }

  const isFireFox = h3.text() === 'Mozilla Firefox'

  if (isFireFox) {
    return body.children('dl').first()
  }

  return body.children('dl').first()
}

/* VIA-HOOK 4/6 参数新增。下面的根包装拍平用 HtmlVia.findSingleRootFolder，判定逻辑在那边。 */
export const parseByString = (content: string, options: IHtmlSerializerOptions = {}) => {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const via = Boolean(opts.viaCompatible)
  const $ = cheerio.load(content)

  const body = $('body')
  let rootDL = getRootFolder(body)
  let rootName = ''

  if (via) {
    const wrapper = findSingleRootFolder(rootDL)
    if (wrapper) {
      rootName = wrapper.title
      rootDL = wrapper.dl
      // 根包装文件夹不进树，回写时凭这个固定值再包一次，保证每次写出的字节一样
      rememberDateAdded(
        ROOT_DATE_KEY,
        Number.isNaN(wrapper.date) ? Math.floor(Date.now() / 1000) : wrapper.date
      )
    }
    // 即使没有包装层（Via 的真实导出就是根层 13 个并列条目），也要记住根级第一个
    // 文件夹的 ADD_DATE 当根节点用的时间，否则回写时它会掉回「当前时间」变成动态值。
    const firstDt = rootDL.children('dt').eq(0)
    const firstH3 = firstDt.children().eq(0)
    if (firstH3.length && firstH3[0].name === 'h3') {
      const firstDate = parseInt(firstH3.attr('add_date'), 10)
      if (!Number.isNaN(firstDate)) rememberDateAdded(ROOT_DATE_KEY, firstDate)
    }
  }

  /* VIA-HOOK 5/6 idOverride：Via 导出没有 ID，改由 HtmlVia.deriveViaId 派生稳定哈希顶替，
     否则官方的自增编号每轮从 1 重新开始，映射表全部失效、书签被反复当新增（越同步越乱）。 */
  const parseNode = (
    node: cheerio.Cheerio<any>,
    parentId?: string | number,
    idOverride?: string | number
  ): TItem<typeof ItemLocation.SERVER> | null => {
    const eq0 = node.children().eq(0)
    if (!eq0.length) return null

    const title = typeof eq0.text() !== 'undefined' ? eq0.text() : ''
    const addDate = parseInt(eq0.attr('add_date'), 10)
    const id =
      idOverride !== undefined ? idOverride : (eq0.attr('id') || legacyIdCounter++)

    // Via / 原生 Netscape 格式用 ADD_DATE 记录添加时间；记下来，回写时原样带出，
    // 这样同一棵树每次写出的字节都完全一致，不会在下一轮同步里被误判成「服务端变了」。
    if (!Number.isNaN(addDate)) {
      rememberDateAdded(String(id), addDate)
    }

    switch (eq0[0].name) {
      case 'h3':
        // folder
        const children = parseDL(node.children('dl').first(), id)
        return new Folder({
          id,
          title,
          parentId,
          children,
          location: ItemLocation.SERVER,
        })
      case 'a':
        // site
        const url = eq0.attr('href') || ''
        return new Bookmark({ id, title, url, parentId, location: ItemLocation.SERVER })
      default:
        return null
    }
  }

  // 同层子节点一起遍历：先数一遍标题，只有出现同级重名时（Via 的导出里就有一对
  // 「免root玩机」）才把序号混进派生 ID，否则两条同名文件夹会撞成同一个 ID 互相覆盖；
  // 没重名时不掺序号，用户手动调整顺序也不会让 ID 变动。
  /* VIA-HOOK 6/6 改成同级批量遍历（先数一遍标题），只有真出现同级重名时才把序号混进 ID。 */
  const parseDL = (dl: cheerio.Cheerio<any>, parentId?: string | number) => {
    const dts = dl
      .children('dt')
      .toArray()
      .filter(ele => ele.name === 'dt')

    const titleCounts = new Map<string, number>()
    dts.forEach(ele => {
      const t = $(ele).children().eq(0).text()
      titleCounts.set(t, (titleCounts.get(t) || 0) + 1)
    })

    const items: TItem<typeof ItemLocation.SERVER>[] = []
    dts.forEach((ele, i) => {
      const dt = $(ele)
      const eq0 = dt.children().eq(0)
      const title = eq0.text()
      const rawId = eq0.attr('id')
      const duplicated = (titleCounts.get(title) || 0) > 1
      let id: string | number | undefined = rawId !== undefined && rawId !== '' ? String(rawId) : undefined
      if (id === undefined && via) {
        id = deriveViaId(parentId || '', title, duplicated ? i : undefined)
      }
      const child = parseNode(dt, parentId, id)
      if (child) items.push(child)
    })
    return items
  }

  const root = parseDL(rootDL)

  return { items: root, rootName }
}

// 非 Via 模式下沿用原实现的自增编号，保证存量账号行为不变
let legacyIdCounter = 1
