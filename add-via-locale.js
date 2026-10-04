/**
 * 补齐 Via 兼容模式新增的两条文案。
 *
 * 用法：node add-via-locale.js [包名 ...]   不带参数则补所有中文包 + en
 *
 * 为什么单独一个脚本：这些条目是本项目新加的（上游 _locales 里不存在），
 * 每次同步上游后跑一次即可，不用手改四个语言包。
 * 只新增、不覆盖已有条目，所以对上游新加的文案是安全的。
 */
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const ENTRY = {
  DescriptionViaCompatibleNoEncrypt: {
    message:
      'Via only reads Netscape-format HTML, so this option will hide the passphrase and file-format settings above, fill in the path Via/bookmarks.html, and lock the format to HTML. Once enabled it cannot be turned off here; to go back to the official format, delete this account and create a new one without checking this box.',
    description:
      'Hint under the Via compatibility checkbox in the new-account wizard.',
  },
  DescriptionViaLocked: {
    message:
      'Via compatibility is on, so the passphrase and file-format settings are hidden: Via only reads unencrypted HTML, and the format is fixed to HTML. To switch back to the official format, delete this account and create a new one without checking Via compatibility.',
    description:
      'Note shown in the WebDAV account settings when Via compatibility is enabled.',
  },
}

// 中文四条 + 英文。同一个 key 各语言一份，不复用英文原文。
// 注意目录名是连字符的 zh-Hans（下划线 zh_Hans 不存在，写错会静默跳过）。
const TRANSLATIONS = {
  zh_CN: {
    DescriptionViaCompatibleNoEncrypt:
      'Via 只能读取 Netscape 格式的 HTML。勾选后将隐藏上方的「密码短语」与「文件格式」，并把路径预填为 Via/bookmarks.html、格式锁定为 HTML。启用后此处不可关闭；若要换回官方格式，请删除本账号后新建一个不勾选的账号。',
    DescriptionViaLocked:
      'Via 兼容已启用，因此「密码短语」与「文件格式」已隐藏：Via 只能读取未加密的 HTML，格式固定为 HTML。若要换回官方格式，请删除本账号后新建一个不勾选 Via 兼容的账号。',
  },
  'zh-Hans': {
    DescriptionViaCompatibleNoEncrypt:
      'Via 只能读取 Netscape 格式的 HTML。勾选后将隐藏上方的「密码短语」与「文件格式」，并把路径预填为 Via/bookmarks.html、格式锁定为 HTML。启用后此处不可关闭；若要换回官方格式，请删除本账号后新建一个不勾选的账号。',
    DescriptionViaLocked:
      'Via 兼容已启用，因此「密码短语」与「文件格式」已隐藏：Via 只能读取未加密的 HTML，格式固定为 HTML。若要换回官方格式，请删除本账号后新建一个不勾选 Via 兼容的账号。',
  },
  zh: {
    DescriptionViaCompatibleNoEncrypt:
      'Via 只能讀取 Netscape 格式的 HTML。勾選後將隱藏上方的「密碼短語」與「文件格式」，並把路徑預填為 Via/bookmarks.html、格式鎖定為 HTML。啟用後此處不可關閉；若要換回官方格式，請刪除本帳號後新建一個不勾選的帳號。',
    DescriptionViaLocked:
      'Via 相容已啟用，因此「密碼短語」與「文件格式」已隱藏：Via 只能讀取未加密的 HTML，格式固定為 HTML。若要換回官方格式，請刪除本帳號後新建一個不勾選 Via 相容的帳號。',
  },
  zh_TW: {
    DescriptionViaCompatibleNoEncrypt:
      'Via 只能讀取 Netscape 格式的 HTML。勾選後將隱藏上方的「密碼短語」與「檔案格式」，並將路徑預填為 Via/bookmarks.html、格式鎖定為 HTML。啟用後此處無法關閉；若要改回官方格式，請刪除本帳號後新增一個未勾選的帳號。',
    DescriptionViaLocked:
      'Via 相容已啟用，因此「密碼短語」與「檔案格式」已隱藏：Via 只能讀取未加密的 HTML，格式固定為 HTML。若要改回官方格式，請刪除本帳號後新增一個未勾選 Via 相容的帳號。',
  },
  en: ENTRY,
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TRANSLATIONS)

for (const locale of targets) {
  const pack = TRANSLATIONS[locale]
  if (!pack) {
    console.log(`跳过 ${locale}（没有对应译文）`)
    continue
  }
  const file = path.join(ROOT, '_locales', locale, 'messages.json')
  if (!fs.existsSync(file)) {
    console.log(`跳过 ${locale}（文件不存在）`)
    continue
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  let added = 0
  let skipped = 0
  for (const [key, value] of Object.entries(pack)) {
    if (key in json) {
      skipped++
      continue
    }
    json[key] = value
    added++
  }
  if (added) {
    fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8')
  }
  console.log(`${locale}：新增 ${added} 条，已存在跳过 ${skipped} 条`)
}

console.log('done')
