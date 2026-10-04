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
  '1. **装扩展** — Edge 打开 `edge://extensions/`、Chrome 打开 `chrome://extensions/` → 开启「开发者模式」→ '
    + '点「加载已解压的扩展程序」，选中本仓库里的 `floccus-via/` 目录。**两个浏览器装法完全一样。**',
  '2. **建同步账号** — 选项页 → 新建账号 → 适配器选 **WebDAV** → 地址填坚果云 `https://dav.jianguoyun.com/dav/`，'
    + '用户名密码用坚果云的「应用密码」。',
  '3. **勾「Via 浏览器兼容」** — 就在向导页的这个 WebDAV 表单里。勾上之后书签文件会**自动填成 `Via/bookmarks.html`**、'
    + '文件格式**锁定为 HTML 且整个选择框消失**（Via 只能读未加密的 Netscape 格式 HTML）。'
    + '**这个开关只能开不能关，想换回官方格式就删号重建。**',
  '',
  '> ⚠️ 第一次同步之前，先读一遍 [README.via.md](README.via.md) 第四章《第一次同步要注意》。',
  '>',
  '> 🚨 **最常见的困惑：「我在手机 Via 里建的书签，电脑上怎么没有？」**',
  '> 电脑（Edge/Chrome）的根节点只能容纳「收藏夹栏 / 其他收藏夹 / 移动收藏夹」这三个固定文件夹。',
  '> **在 Via 里点「新建」会默认放在根目录，电脑端放不下 → 会被静默跳过。**',
  '> 这些项**不会丢**（同步不会反向删除云端），但**电脑上永远看不到**，只有 Via 端有。',
  '> 新建时请**选一个具体文件夹**，永远不要放在根目录。详细说明见',
  '> [README.via.md 第四章](README.via.md#四第一次同步要注意重要)。',
  '',
  '## 📚 文档导航',
  '',
  '| 场景 | 去哪 |',
  '| --- | --- |',
  '| 完整中文说明（**推荐入口**） | [README.via.md](README.via.md) — 改动清单、同步流程、验收清单、常见问题 |',
  '| 同步上游 floccus 新版本后要做什么 | [README.via.md](README.via.md) 第九章 + 第十一章《同步后的验收清单》 |',
  '| 排查 Via 同步错乱 / 书签乱序 | [README.via.md](README.via.md) 第十一章 P1 清单（按危险度排序） |',
  '| 为什么设置页看不到「密码短语」和「文件格式」 | [README.via.md](README.via.md) 第十一章 11.11 |',
  '| 上游原项目 README（英文、官方） | [README.upstream.md](README.upstream.md) |',
  '',
  '## 🛠 本地常用命令',
  '',
  '```bash',
  'node sync-upstream.js          # 同步上游前先体检：哪些文件会冲突',
  'npx gulp build                 # 编译到 dist/',
  'node pack-for-chrome.js        # 产出交付物 zip（Chrome / Edge 通用）',
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
