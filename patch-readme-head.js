/**
 * 把 floccus-via 的中文导引卡插到根 README.md 的最前面。
 *
 * 为什么需要这个脚本：
 *   根 README.md 是上游 floccus 的仓库首页文档，上游随时可能改它。
 *   我们 fork 之后需要在最前面插一段自己的导引 —— 手工插一次很容易，
 *   但每次同步上游都要重新插一次（或产生冲突），所以用脚本固化。
 *
 * 用法：node patch-readme-head.js
 *   --check  只检查导引卡是否已在位，在位就跳过（幂等，重跑无副作用）
 *
 * 安全边界：脚本只认「导引卡标记行」，在标记行已存在时直接返回，
 * 绝不重复插入，也绝不改动 README.md 的其余部分（包括原始 CRLF 行尾）。
 */
const fs = require('fs')

const MARK = '<!-- floccus-via 导引卡 -->'
const FILE = 'README.md'
const CHECK = process.argv.includes('--check')

if (fs.readFileSync(FILE, 'utf8').includes(MARK) && CHECK) {
  console.log('导引卡已在位，跳过。')
  process.exit(0)
}

const CARD = [
  MARK,
  '> [!IMPORTANT]',
  '> **这是 [floccus](https://github.com/floccusaddon/floccus) 的个人 fork：`floccus-via`**',
  '> 在原项目之外，额外支持 [Via 浏览器](https://via.stevenaet.com/) 书签格式，可与 Via / Edge 双向同步。',
  '> 本分支的改动不回写上游；上游原版 README 保留在 [README.upstream.md](README.upstream.md)。',
  '',
  '## 🚀 三分钟上手',
  '',
  '1. **装扩展** — Edge / Chrome 打开 `chrome://extensions/` → 开发者模式 → 「加载已解压的扩展程序」，'
    + '选中本仓库里的 `floccus-via/` 目录（也可以直接把打包产物 `floccus-via.crx` 拖进窗口）。',
  '2. **配同步** — 选项页 → 新建 WebDAV 账号 → 地址填坚果云 `https://dav.jianguoyun.com/dav/`，'
    + '路径填 `bookmarks.html`。',
  '3. **开 Via 开关** — 同一个 WebDAV 卡片里勾上「Via 浏览器兼容」，可顺手指定 Via 中的根文件夹名。'
    + '**勾上才走 Via 格式，不勾仍是 floccus 官方原格式。**',
  '',
  '> ⚠️ 第一次同步之前，先读一遍 [README.via.md](README.via.md) 第一章《第一次同步要注意》。',
  '',
  '## 📚 文档导航',
  '',
  '| 场景 | 去哪 |',
  '| --- | --- |',
  '| 完整中文说明（**推荐入口**） | [README.via.md](README.via.md) — 改动清单、同步流程、验收清单、常见问题 |',
  '| 同步上游 floccus 新版本后要做什么 | [README.via.md](README.via.md) 第九章 + 第十一章《同步后的验收清单》 |',
  '| 排查 Via 同步错乱 / 书签乱序 | [README.via.md](README.via.md) 第十一章 P1 清单（按危险度排序） |',
  '| 上游原项目 README（英文、官方） | [README.upstream.md](README.upstream.md) |',
  '',
  '## 🛠 本地常用命令',
  '',
  '```bash',
  'node sync-upstream.js          # 同步上游前先体检：哪些文件会冲突',
  'npx gulp build                 # 编译到 dist/',
  'node pack-for-chrome.js        # 产出 floccus-via.crx（拖拽即装）+ zip',
  'node check-i18n.js             # 中文文案缺不缺',
  'node check-official-compat.js  # 不开 Via 时输出是否仍与官方逐字节一致',
  'node check-zip.js && node audit-extension.js   # 交付物自检',
  '```',
  '',
  '---',
  '',
]

// 上游 README 是 CRLF，导引卡也用 CRLF 拼，避免混行尾导致整份文件 diff 飘
const body = fs.readFileSync(FILE, 'utf8').replace(/^\r?\n/, '')
fs.writeFileSync(FILE, CARD.join('\r\n') + body, 'utf8')
console.log('导引卡已插入，README.md 现在 ' + fs.readFileSync(FILE, 'utf8').split('\n').length + ' 行')
