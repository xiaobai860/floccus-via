/**
 * 补齐 / 修正 Via 兼容模式新增的文案条目。
 *
 * 用法：node add-via-locale.js [包名 ...]   不带参数则处理 zh / zh_CN / zh-Hans / zh_TW / en
 *
 * ⚠️ 为什么用「逐行替换」而不是 JSON.parse + stringify：
 *   语言包 300+ 条，上游排版是人工维护的。整份 parse 再 stringify 会重排全文
 *   （diff 显示 700+/700- 假改动），**更会把 {message, description} 压成裸字符串**。
 *   裸字符串是真实踩过的坑：Vue i18n 收到它直接抛
 *   `TypeError: A message must be provided as a String or AST.`，
 *   表现为选项页白屏、点「继续」没反应。本脚本只动目标 key 所在的那几行。
 *
 * 幂等：
 *   - 不存在 → 追加（对象形态）
 *   - 是裸字符串 → 修成对象形态
 *   - 已是对象且 message 一致 → 跳过
 */
const fs = require('fs')
const path = require('path')

const ROOT = __dirname

const T = {
  DescriptionViaCompatibleNoEncrypt: {
    en: {
      message:
        'Via only reads Netscape-format HTML. Checking this hides the passphrase and file-format settings above, fills the path in as Via/bookmarks.html and locks the format to HTML. Once enabled it cannot be turned off here; to go back to the official format, delete this account and create a new one without checking this box.',
      description: 'Hint under the Via compatibility checkbox in the new-account wizard.',
    },
    zh_CN: {
      message:
        'Via 只能读取 Netscape 格式的 HTML。勾选后将隐藏上方的「密码短语」与「文件格式」，并把路径预填为 Via/bookmarks.html、格式锁定为 HTML。启用后此处不可关闭；若要换回官方格式，请删除本账号后新建一个不勾选的账号。',
      description: '新建账号向导里 Via 兼容勾选框下方的说明。',
    },
    'zh-Hans': {
      message:
        'Via 只能读取 Netscape 格式的 HTML。勾选后将隐藏上方的「密码短语」与「文件格式」，并把路径预填为 Via/bookmarks.html、格式锁定为 HTML。启用后此处不可关闭；若要换回官方格式，请删除本账号后新建一个不勾选的账号。',
      description: '新建账号向导里 Via 兼容勾选框下方的说明。',
    },
    zh: {
      message:
        'Via 只能讀取 Netscape 格式的 HTML。勾選後將隱藏上方的「密碼短語」與「文件格式」，並把路徑預填為 Via/bookmarks.html、格式鎖定為 HTML。啟用後此處不可關閉；若要換回官方格式，請刪除本帳號後新建一個不勾選的帳號。',
      description: '新建帳號精靈裡 Via 相容勾選框下方的說明。',
    },
    zh_TW: {
      message:
        'Via 只能讀取 Netscape 格式的 HTML。勾選後將隱藏上方的「密碼短語」與「檔案格式」，並將路徑預填為 Via/bookmarks.html、格式鎖定為 HTML。啟用後此處無法關閉；若要改回官方格式，請刪除本帳號後新增一個未勾選的帳號。',
      description: '新增帳號精靈裡 Via 相容勾選框下方的說明。',
    },
  },
  DescriptionViaLocked: {
    en: {
      message:
        'Via compatibility is on, so the passphrase and file-format settings are hidden: Via only reads unencrypted HTML, and the format is fixed to HTML. To switch back to the official format, delete this account and create a new one without checking Via compatibility.',
      description: 'Note shown in the WebDAV account settings when Via compatibility is enabled.',
    },
    zh_CN: {
      message:
        'Via 兼容已启用，因此「密码短语」与「文件格式」已隐藏：Via 只能读取未加密的 HTML，格式固定为 HTML。若要换回官方格式，请删除本账号后新建一个不勾选 Via 兼容的账号。',
      description: '账号设置页里 Via 兼容已启用时显示的说明。',
    },
    'zh-Hans': {
      message:
        'Via 兼容已启用，因此「密码短语」与「文件格式」已隐藏：Via 只能读取未加密的 HTML，格式固定为 HTML。若要换回官方格式，请删除本账号后新建一个不勾选 Via 兼容的账号。',
      description: '账号设置页里 Via 兼容已启用时显示的说明。',
    },
    zh: {
      message:
        'Via 相容已啟用，因此「密碼短語」與「文件格式」已隱藏：Via 只能讀取未加密的 HTML，格式固定為 HTML。若要換回官方格式，請刪除本帳號後新建一個不勾選 Via 相容的帳號。',
      description: '帳號設定頁裡 Via 相容已啟用時顯示的說明。',
    },
    zh_TW: {
      message:
        'Via 相容已啟用，因此「密碼短語」與「檔案格式」已隱藏：Via 只能讀取未加密的 HTML，格式固定為 HTML。若要改回官方格式，請刪除本帳號後新增一個未勾選 Via 相容的帳號。',
      description: '帳號設定頁裡 Via 相容已啟用時顯示的說明。',
    },
  },
}

const q = (s) => JSON.stringify(s)

/** 用「三行对象」替换掉 key 所在的那一行（不管它原来是字符串还是对象） */
function replaceKeyLine(lines, key, want) {
  const prefix = '"' + key + '"'
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    // 顶层 key 的行都以 `  "Key":` 开头
    if (!t.startsWith(prefix + ':')) continue

    const indent = line.slice(0, line.length - line.trimStart().length)

    // 已经是对象形态且 message 一致 → 跳过
    if (t.startsWith(prefix + ': {')) {
      // 对象可能跨多行：从本行起累计花括号，直到 depth 归零的那一行
      // （上一版在「首行就闭合」和「首行同时开闭」两种情况上算错了，
      //  把 en 包打成了非法 JSON —— 关键是只数 { } 两个字符，不看其它内容。）
      let j = i
      let depth = 0
      do {
        for (const ch of lines[j]) {
          if (ch === '{') depth++
          else if (ch === '}') depth--
        }
        if (depth <= 0) break
        j++
      } while (j < lines.length)
      if (j >= lines.length) throw new Error('对象未闭合: ' + key + ' @' + locale)
      const seg = lines.slice(i, j + 1).join('\n')
      if (seg.includes(q(want.message))) return { lines, state: '已正确' }
      const lastLine = lines[j]
      const hadComma = lastLine.trim().endsWith(',')
      const replaced = [
        indent + prefix + ': {',
        indent + '  "message": ' + q(want.message) + ',',
        indent + '  "description": ' + q(want.description),
        indent + '}' + (hadComma ? ',' : ''),
      ]
      return {
        lines: [...lines.slice(0, i), ...replaced, ...lines.slice(j + 1)],
        state: '更新对象',
      }
    }

    // 裸字符串（含本行以逗号结尾的情况）→ 换成对象
    const hasComma = t.endsWith(',')
    const replaced = [
      indent + prefix + ': {',
      indent + '  "message": ' + q(want.message) + ',',
      indent + '  "description": ' + q(want.description),
      indent + '}' + (hasComma ? ',' : ''),
    ]
    return { lines: [...lines.slice(0, i), ...replaced, ...lines.slice(i + 1)], state: '修成对象' }
  }
  return { lines, state: null }
}

/** key 完全不存在 → 追加到最后一个顶层条目之后 */
function appendKey(lines, key, want) {
  let last = -1
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    if (t.startsWith('"') && t.includes('":')) last = i
  }
  if (last < 0) throw new Error('找不到可追加的位置')
  const prev = lines[last].trim().endsWith(',') ? lines[last] : lines[last] + ','
  const block = [
    prev,
    '  "' + key + '": {',
    '    "message": ' + q(want.message) + ',',
    '    "description": ' + q(want.description),
    '  }',
  ]
  return [...lines.slice(0, last), ...block, ...lines.slice(last + 1)]
}

const locales = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['zh', 'zh_CN', 'zh-Hans', 'zh_TW', 'en']

for (const locale of locales) {
  const file = path.join(ROOT, '_locales', locale, 'messages.json')
  if (!fs.existsSync(file)) { console.log(`跳过 ${locale}（无此包）`); continue }

  let lines = fs.readFileSync(file, 'utf8').split('\n')
  const report = []

  for (const [key, byLocale] of Object.entries(T)) {
    const want = byLocale[locale]
    if (!want) { report.push(key + '=无译文'); continue }
    const r = replaceKeyLine(lines, key, want)
    if (r.state) { lines = r.lines; report.push(key + '=' + r.state) }
    else { lines = appendKey(lines, key, want); report.push(key + '=新增') }
  }

  fs.writeFileSync(file, lines.join('\n'), 'utf8')

  // 自检：写完必须仍是合法 JSON 且两个 key 都是对象
  let ok = true
  try {
    const m = JSON.parse(fs.readFileSync(file, 'utf8'))
    for (const [key] of Object.entries(T)) {
      if (!m[key] || typeof m[key] === 'string' || !m[key].message) ok = false
    }
  } catch (e) { ok = false }
  console.log(`${locale}：${report.join('  ')}${ok ? '  ✅校验通过' : '  ❌校验失败'}`)
}

console.log('done')
