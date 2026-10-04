# floccus-via（Edge 版）

在 floccus 官方版基础上做了 **Via 浏览器书签格式兼容** 的分支，用于在 **Windows Edge（Chrome 内核浏览器）** 与 **手机 Via 浏览器** 之间通过坚果云 WebDAV 里的 `bookmarks.html` 双向同步书签。

官方版 floccus 读不懂 Via 导出的书签文件（Via 那棵树结构跟 floccus 的「书签栏 / 其他书签」对不上，且文件里只有 `ADD_DATE`、没有 floccus 自己的 `ID` / `TAGS`；Via 每次重传还会把 `ID` 抹掉），一同步路径就层层错位，越同步越乱。本分支把读写两端都改成 Via 的原生 Netscape 格式，两边说的是同一个"方言"，不会再互相污染。

> 上游项目：https://github.com/floccusaddon/floccus （MPL-2.0），本次改动是追加式的，没有改写官方的同步算法。

---

## 一、安装到 Edge

两种装法任选一种，**推荐第 1 种**（把 zip 直接拖进扩展页）：

### 方式 1：拖 zip（推荐）

1. 打开 `edge://extensions/`（或 Chrome 的 `chrome://extensions/`）。
2. 把 `floccus-via.zip` **直接拖到页面上**，确认安装。
3. 列表里出现名为 **floccus-via** 的条目即成功；点图钉固定到工具栏，点图标 → **选项** 进去配置。

> 这个 zip 里已经不含任何以 `_` 开头的目录/文件名（打包时不再带规范保留的 `_locales/`，语言包被编译进 `dist/js` 的 chunk 里了），所以拖拽安装不会被拒。

### 方式 2：加载已解压的扩展程序

1. 打开 `edge://extensions/`，打开右上角 **「开发者模式」**开关。
2. 点 **「加载已解压的扩展程序」**，选择扩展目录 `D:\xiaom\Documents\WorkBuddy\浏览器扩展\floccus-via`（**选这个文件夹本身**，别选里面的 `dist`）。

### 两种方式的区别

- **拖 zip**：ID 由 Edge 随机生成，以后更新要重新装一次；好处是不用管目录在哪。
- **加载已解压目录**：ID 由该目录的绝对路径哈希决定（换目录 = 换 ID），以后更新只要**覆盖文件夹内容**再回扩展页点该扩展的「重新加载」即可，不用重装。

### 如果安装失败：按报错对照处理

打包后有两道自检（`node check-zip.js` 查交付物 zip、`node audit-extension.js` 查扩展目录），任何一条不通过都会在终端里 FAIL 出来。下面几种报错正常情况下不会再出现；手上的 zip 是旧版的话，重新跑一遍打包再拖即可。

**① 报错含 `Filenames starting with "_" are reserved for use by the system`**

```
Cannot load extension with file or directory name _locales\zh\messages.json.
```

扩展包里混进了以 `_` 开头的目录（`_locales`，规范保留名）。构建流程已经不会这么做了，用最新 zip 重装。

**② 报错含 `Couldn't load icon ... specified in action`**

```
Couldn't load icon icons/logo.png specified in action.
```

两个可能，先按第一个查：

1. **zip 条目名写成了反斜杠** —— zip 规范要求条目名用 `/`。用 PowerShell 的 `Compress-Archive` / .NET `ZipFile` 在 Windows 上生成的 zip 会写成 `icons\logo.png`；Windows 资源管理器解压时把它还原成目录，所以肉眼看不出问题，但 **Edge / Chromium 自己的解压器会把 `icons\logo.png` 当成一个文件名**，于是 `icons/logo.png` 永远找不到。**本包的 zip 已改用 jszip 生成，条目名全是正斜杠**，这条不会再踩。
2. 图标文件本身缺失或损坏 —— 自检会拦（会逐条核对 `manifest.json` 里引用的图标是否真的在包里）。

**③ 报错含 `Manifest is not valid JSON` / `_locales` 相关 / `version` 格式**

这类是 `manifest.json` 本身不合规。`audit-extension.js` 会逐项核对（必填字段、`manifest_version`、`version` 段数、CSP、权限白名单、`default_locale` 与 `_locales` 是否配套等），终端里会直接指出是哪一条。

有一条是**本分支特意做的改动**，值得说明：上游 floccus 的 `manifest.json` 里带着 `"default_locale": "en"`，而 WebExtensions 规范规定**声明了 `default_locale` 就必须同时存在 `_locales` 目录**，否则 Chromium 直接在 manifest 校验阶段拒载。本分支为了绕开「`_` 开头目录名会被拖 zip 安装拒绝」这条规则，把 `default_locale` 整个删掉了 —— 之所以能删，是因为 floccus 的文案在构建时就被 webpack 编译进了 JS chunk（`src/lib/native/I18n.ts` 直接 `import` 了 `_locales/en/messages.json`，中文则走 `require.context` 懒加载），运行时**一次都没调过 `chrome.i18n`**，删掉这个字段不会影响界面语言。

安装失败会在 `...\Edge\User Data\Default\UnpackedExtensions\` 留下一个 `floccus-via_xxx_随机数` 的残留目录，那批失败残留删不删都行，不影响。

> 注意：`manifest.json` 里的 `dist/...` 路径是相对根目录的，别把整个文件夹挪到别的层级里。想更新版本时，重新跑打包脚本覆盖目录，然后到 `edge://extensions/` 点该扩展的「重新加载」即可。

---

## 二、和官方 floccus 共存

本分支在扩展管理页里叫 **floccus-via**（图标 tooltip 是 `Open floccus-via options`，选项页标题也是 `floccus-via`），和官方商店版的 `floccus bookmarks sync` 一眼能分。

**技术上能不能共存？能。** 官方版是商店安装，扩展 ID 固定；本分支是「加载已解压的扩展程序」，Chromium 用**解压目录的绝对路径哈希**生成 ID，所以只要放在**别的目录**里（`D:\...\浏览器扩展\floccus-via\` 与官方版的目录不同），两边 ID 就不一样，于是：

- 扩展管理页里两行独立条目，互不顶掉；
- 账号配置、书签缓存按扩展 ID 隔离存，互不干扰（你在官方版里配的账号，本分支看不到，反之亦然）；
- 两个插件各自有独立的后台定时同步，不会互相抢占。

**唯一的真坑：不要让两个插件同步同一个 `bookmarks.html`。**

> 官方版写出去的是它自己的格式（带 `ID` / `TAGS`），本分支写出去的是 Via 认得的格式（只有 `ADD_DATE`）。两个都指向同一个文件时，谁后写谁整体覆盖另一个，另一边下次同步读到的就是"格式不对"的文件 —— 也就是你之前遇到的「越同步越乱」。

所以共存时二选一：

| 方案 | 做法 |
| --- | --- |
| **A（推荐）** | 坚果云里那份 `bookmarks.html` 交给 **floccus-via** 独家同步；官方版要么卸载，要么干脆不同步（留着当只读备份） |
| **B** | 两个都要用，就让它们写**不同的文件**：例如官方版用 `bookmarks.pc.html`、floccus-via 仍用 `bookmarks.html`，两个账号在选项页里分开配 |

另注意：本分支**首次同步会改写坚果云那一份**的字节格式（去 `ID`/`TAGS`、补 `ADD_DATE`）。如果官方版也盯着同一个文件，改写之后官方版就读不懂了 —— 这就是方案 A 存在的理由。

---

## 三、配置账号（WebDAV → 坚果云）

### 1. 先拿坚果云的 WebDAV 账密

1. 坚果云网页版 → **账户信息** → **安全 / 添加应用**，应用名随便填（如 `floccus`），生成一组 **「应用密码」**（不是登录密码）。
2. 坚果云给出的 WebDAV 地址形如 `https://dav.jianguoyun.com/dav/personal/<你的账号>/`；把路径部分换成 `bookmarks.html` 就是我们要用的完整地址（放到子目录的话，该目录要先手动建好）。

### 2. 在扩展里填

选项页 → 添加账号（适配器选 **WebDAV**）：

| 选项 | 填什么 |
| --- | --- |
| 账号标签 | 随手起名，如「手机 Via」 |
| WebDAV URL | 上面拼出的完整地址，结尾是 `bookmarks.html` |
| 用户名 | 坚果云账号 / 邮箱 |
| 密码 | 上面生成的**应用密码** |
| **书签文件** | `bookmarks.html`（相对 URL 的路径部分） |
| 文件类型 | **HTML**（不要选 XBEL） |

### 3. 打开「Via 浏览器兼容」（关键开关）

> 这一整块界面已经是**中文**的。若你看到某几行是英文，说明那个词条没进当前语言包 —— 中文环境走的是 `zh_CN` 语言包，本分支已把它和 `zh` 对齐到 0 缺失（`node check-i18n.js` 可复验）。

WebDAV 专区里有一张 **「Via 浏览器兼容」** 卡片：

- ☑ **Via 浏览器兼容**：**必须勾上**。勾上之后
  - *读*：识别 Via 的书签结构，给没有 ID 的书签/文件夹派生**稳定的哈希 ID**（同级重名文件夹会混入序号防撞 ID）；
  - *写*：输出标准 Netscape 文件头 + `ADD_DATE`，**不写** floccus 自己的 `ID` / `TAGS`，所以 Via 读得懂、也不会回头覆盖成残缺格式。
- **Via 根文件夹名**：**留空**。留空 = 沿用文件里读到的名字（例如 `一加5`），保证电脑写出去的和 Via 认得的是同一棵树。只有想强制换个根名字时才填。

### 4. 选同步根：整个书签树

在 **「本地目标 / 收藏夹」** 一栏，点输入框右侧 📁 打开书签树，**选中最顶上那一项**（根节点，下挂「书签栏」「其他书签」）。这样书签栏 + 其他书签全量同步。

> Via 那边不区分「书签栏 / 其他书签」，它是一整棵树，所以全量同步后两边的目录结构会以 Via 的为准对齐（手机上就是 `一加5 → 手机应用 / 阅读 / root相关 / 游戏 / 刷流量 / tvbox / 互传 / 免root玩机 / DeepSeek / Epic` 这一套）。

### 5. 同步策略

- 策略选 **「始终将本地更改与来自其他浏览器的更改合并（推荐）」**（默认策略）。
- **安全保护（Failsafe）保持「已启用」**：单轮增删超过 20% 时 floccus 会停下来问你，是防误删的最后一道保险。

---

## 四、第一次同步要注意（重要）

1. **先备份 Edge 书签**：`edge://bookmarks/` → 右上角 ⋯ → **导出书签**。
   原因：你之前用官方 floccus 同步过，两边已经乱过一轮；首次同步会以服务器（手机上 Via 那套）为准去对齐本地，本地原来那些"乱掉的"书签可能被清掉。
2. 第一次**手动同步一次**（选项页「立即同步」），别让自动同步抢在你之前跑；同步完去 `edge://books/marks` 目视检查后再放自动同步。
3. 首次同步会把坚果云里的 `bookmarks.html` **从官方 floccus 格式改写成 Via 原生格式**（去掉 `ID`/`TAGS`、补上 `ADD_DATE`）。**这是预期行为**，也是让 Via 能继续读同一个文件所必需的。
4. 写入之前，先在坚果云网页版把 `bookmarks.html` 手动复制一份叫 `bookmarks.bak.html`；坚果云本身也有历史版本功能，双保险。

---

## 五、手机 Via 那边的注意事项

Via 是双向的：它既下载 `bookmarks.html` 导入，也会把自己改动后的书签**重新上传覆盖同一个文件**。所以：

- ✅ 只要电脑端写的是 Via 认得的格式，两边互相覆盖就是"同一份东西的不同快照"，不会错位、不会丢。
- ⚠️ 别再挂别的 WebDAV 客户端同时写同一个 `bookmarks.html`，后写的会整体覆盖先写的，且没有合并。
- ⚠️ Via 不帮着合并冲突，谁最后写谁生效。大改之前手动存一份副本。
- ⚠️ 手机端大批量改书签时，别同时跑电脑端同步；同步间隔建议 1 小时以上。

---

## 六、日常怎么用

- 电脑改书签 → 同步 → 坚果云 `bookmarks.html` 更新 → 手机 Via 用自带设置同步拿到。
- 手机 Via 改书签 → Via 上传覆盖 `bookmarks.html`（格式与本分支写的一致）→ 电脑端下次同步拉回来。
- 无 ID 节点用的是**内容哈希派生 ID**（murmurhash3，由父路径 + 标题 + 同级序号决定），目录结构不变 ID 就不变；Via 每次重传把 `ID` 抹掉也不会造成编号漂移、把老书签误判成新书签重复添加。
- 输出是**确定性**的：同一棵树两次写出的字节完全一致，不会每轮都"以为文件变了"而产生虚假增量。

---

## 七、本分支改了什么（代码侧）

| 文件 | 改动 |
| --- | --- |
| `src/lib/serializers/HtmlVia.ts` | **Via 插槽（纯新增，永不与上游冲突）**：稳定哈希 ID、ADD_DATE 记忆与 TTL 清理、根包装文件夹识别、Via 文件头、属性/文本转义、`deriveViaId`（同级重名防撞 ID）。同步上游时这个文件一行都不用动 |
| `src/lib/serializers/Html.ts` | **只剩 6 个 `VIA-HOOK n/6`**：新增 `viaCompatible` / `rootFolderName` 两个可选参数（不传 = 官方行为），在 `_serializeFolder` 里两条渲染分支、在 `parseByString` 里根拍平、在 `parseNode` 里接 `idOverride`、在 `parseDL` 里做同级重名计数。via 的业务逻辑都在上一行的 `HtmlVia.ts` |
| `src/lib/adapters/WebDav.ts` | 新增 `via_compatible` / `via_root_folder` 两个选项；按 Via 选项选择序列化参数；`createHTML` 在 via 模式输出 Via 风格文件头 |
| `src/lib/Tree.ts` | `Folder` 增加 `viaRootName`，回写时把根文件夹名字原样包回去 |
| `src/ui/components/OptionsWebdav.vue` | 新增「Via 浏览器兼容」设置卡片 |
| `_locales/en/messages.json` | 新增 5 个英文案键（Via 兼容卡片用） |
| `_locales/zh/messages.json` | 5 条简体中文 Via 文案 |
| `_locales/zh_CN/messages.json`、`_locales/zh-Hans/messages.json` | **补齐 27 条**。**关键**：`src/ui/index.js` 用 `navigator.languages` 选语言，中文 Edge 命中的是 `zh_CN` 而不是 `zh`，可 `zh_CN` 是上游落后的一版，缺 Via 那 5 条和「标签 / 标题 / 排序依据 / 显示密码…」等 16 条 —— 缺的会逐 key 回退英文，界面上就冒出一整块英文 |
| `_locales/zh_TW/messages.json` | 补齐 31 条繁体文案 |
| `src/lib/native/I18n.ts` | 回退链由「当前包 → 英文」改成「当前包 → 同语系兜底包 → 英文」并**逐 key** 查找。现在 `zh_CN` / `zh-Hans` 缺词条会借道 `zh`，只有 `zh_TW` 直接回退英文（不把简体塞给繁体用户），彻底避免"某个语言包落后一版就整块露英文" |
| `check-i18n.js` | 文案覆盖自检：扫源码里所有 `t('Xxx')` 引用，逐语言包比对该 key 是否存在，并单独列出中文包缺口。**新增（本次）** |
| `sync-upstream.js` | 跟上游前的冲突体检： fetch 后列出上游新提交/新文件，交叉比对本分支改过的 13 个文件，再用 `git merge-tree` dry-run 提前报真冲突文件，最后给出合并后固定六步。**新增（本次）** |
| `check-official-compat.js` + `webpack.official-check.js` + `src/entries/official-compat.js` | 官方格式对等回归：**不开 Via 开关时，输出必须和官方 floccus 5.11.1 逐字节一致**。指纹写死在脚本里（`33ea98f5…` / 39147 字节）。上游一改官方序列化格式，或我们的改动不小心漫过 via 分支污染了官方路径，这脚本会立刻报 FAIL。**新增（本次）** |
| `manifest.json` | 删掉上游的 `"default_locale": "en"`。规范规定声明它就必须配套 `_locales` 目录，而本包刻意不带 `_locales`（`_` 开头目录名会被拖 zip 安装拒绝）。运行时一次都没调 `chrome.i18n`，文案已编译进 JS，删掉这个字段不影响界面语言 |
| `html/background.html` | 删掉写死的 `<script src="../../lib/chrome-promise.js">`。`lib/` 里从来没有这个文件，全仓库也没人用全局 `ChromePromise`，留着只会让 background 页面加载时多一条 404 |
| `pack-for-edge.js` | 把 `dist/**` + `manifest.json` + `icons` 组装成扩展目录并打 zip（**刻意不带 `_locales`、不带构建脚本 `lib/`**，见下），同时排除测试产物 / `*.map`、把本文档拷进去。**zip 用 jszip 生成而非 `Compress-Archive`**，见第八节 |
| `check-zip.js` | 交付物 zip 自检：无 `_` 开头名、**条目名全为正斜杠**、无保留设备名、无测试/构建残留、manifest 引用齐全、`default_locale` 与 `_locales` 配套、图标是有效 PNG、全部条目 CRC 通过 |
| `audit-extension.js` | 扩展目录合规审计（按 Chromium 加载规则 33 项，四组：包结构 / manifest 字段 / 引用完整性 / 运行期隐患）。**新增（本次）**，用来一次性兜住所有「装不上」的已知原因，不必再靠报错逐个补 |

## 八、重新构建 / 重新打包

```bash
cd floccus-src
npm install
node check-i18n.js        # 文案覆盖自检：中文包必须 0 缺失，否则界面会露出英文
npx gulp build            # 产出 dist/
node pack-for-edge.js     # 覆盖生成 ../floccus-via 与 floccus-src/floccus-via.zip
node pack-for-chrome.js   # 再多打一个 floccus-src/floccus-via.crx（自签名，Chromium 通用）
node check-zip.js         # 交付物 zip 自检，期望 ALL PASS
node audit-extension.js   # 扩展目录合规审计，期望 ALL PASS
```

> `pack-for-chrome.js` 默认会先调一遍 `pack-for-edge.js`，想跳过重打、只补 crx 就加参数：`node pack-for-chrome.js --no-repack`。
> crx 用的私钥存在 `floccus-src/key.pem`（上游 `.gitignore` 已忽略它），**第一次生成后就别删别换** —— 换了私钥，下次打出来的 crx 在 Chrome 眼里是另一个扩展，旧的那份就再也更新不了。

> `npx gulp build` 每次都会重新生成 `dist/js/mocha.js`、`dist/js/test.js`、`dist/index.html` 这些测试产物，由 `pack-for-edge.js` 里的 `SKIP_FILES` / `SKIP_DIRS` 拦掉，所以打包前不用手动清 dist。

> **zip 为什么不用 `Compress-Archive`？** PowerShell 的 `Compress-Archive` / .NET 的 `ZipFile` 在 Windows 上会把条目标记成 `icons\logo.png`（反斜杠）而不是 zip 规范要求的 `icons/logo.png`。Windows 资源管理器解压时会把反斜杠还原成目录，所以本地看不出问题；但 **Edge / Chromium 自己的解压器会把 `icons\logo.png` 当成一整个文件名**，结果 `icons` 目录是空的，`manifest.json` 里写的 `icons/logo.png` 找不到，报 `Couldn't load icon icons/logo.png specified in action.` —— 而且用「加载已解压的目录」方式装反而一切正常，很容易被误导成玄学。所以这里直接用 `jszip` 生成 zip（条目名强制正斜杠、显式写目录条目、DEFLATE 压缩，11.5 MB → 4.9 MB）。

### 能不能装到 Chrome？装 crx 还是 zip？

**能，Chrome 完全支持**，因为这份 manifest 走的就是官方 `manifest.chrome.json` 那条线（MV3 + `service_worker` + `action` + `host_permissions`），只额外加了 Via 兼容逻辑，没用任何 Chromium 独有的东西。

- **装 zip**：`edge://extensions/` / `chrome://extensions/` 打开开发者模式 → 「加载已压缩的扩展程序」，选 `floccus-src/floccus-via.zip`。
- **装 crx**：把 `floccus-src/floccus-via.crx` 直接拖到 `chrome://extensions/` 上。crx 是 **CRX3 自签名**的，Chrome 会提示「无法验证此次安装」，点「继续安装」就行 —— 自签名 crx 从头就长这样，不是打包坏了。
- **最省事**：直接把整个 `floccus-via/` 目录指给「加载已解压的扩展程序」。平时开发/debug 建议用这个，改完代码刷新一下就生效，不用重打 crx。

需要注意的三点：

1. `manifest.json` 里我们故意**没有** `default_locale`（文案是运行时从内联语言包取的，见第七节 `I18n.ts`）。Chrome 上同样走这条路径，中文正常，不会因为缺 `default_locale` 变英文。
2. **权限比旧版多了一个 `tabGroups`**（和官方 Chrome 版一致，`src/lib/LocalTabs.ts` 会 `browser.tabGroups.query({})` 读标签页分组）。不加这个权限时代码有 try/catch 兜底，不会崩，但分组信息会整片拿不到。
3. 本地自签名 crx / 解压目录都随便装；**想上 Chrome 商店得用官方的发布密钥重签**，自签那份只能自己用。另外 `unlimitedStorage` 这类权限在商店审核时会被追问用途，本地装不受影响。

### 为什么包比官方的小那么多

默认剔除 source map，实测三笔账（都是 `dist/` 部分、DEFLATE level 6 之后）：

| 打法 | 条目数 | 压缩后 |
|---|---|---|
| 剔除 source map（默认） | 155 | **4.86 MB** |
| 保留 source map（≈官方 `gulp release` 的打法） | 225 | **10.88 MB** |
| dist 目录原始体积（未压缩） | 225 | 46.5 MB |

差的这 6 MB 主要来自 `dist/js` 下 **77 个 `.map`**（原始 32 MB）—— 它们是 `npx gulp build` 用 `webpack.dev`（`devtool: cheap-module-source-map`）产出来的，官方本地构建和商店上传包里也都带着这些 map。我们剔掉是因为运行时根本不读它，塞进去只是白涨体积、拖 zip 时还要整包复制到 AppData。

想跟官方包完全对齐就带参数打：`node pack-for-edge.js --with-maps`（会塞回这些 map，并在控制台告诉你塞了几个）。

剩下那 46.5 MB → 4.86 MB 的 9.5 倍压缩比是 DEFLATE 干出来的：JS 被 webpack 拆成几百个 chunk 后 repeats 极多，压得很狠。所以**包小不等于功能少**，真正的功能代码就是那 4.9 MB。

顺带说一句：本地 `floccus-src/dist/` 之所以看起来有 50+ MB，是因为里面还躺着 `via-check` / `official-check` / `via-check-tsc` 三个校验产物（共约 6.4 MB，也是这次改造自己加的，官方没有），它们被 `pack-for-edge.js` 的 `SKIP_DIRS` 挡在包外。

### 两道自检分别在防什么

**`check-zip.js`** —— 防「拖 zip 装不上」，一共这几道闸：

1. 没有以 `_` 开头的路径段 —— Edge / Chrome 会因为 `Filenames starting with "_" are reserved for use by the system` 直接拒绝加载整个扩展；
2. 条目名全为正斜杠 —— 就是上面那个 `Couldn't load icon` 的坑；
3. 无 Windows 保留设备名（CON / COM1 / LPT9…）；
4. 无测试 / 构建脚本残留；
5. `manifest.json` 里 `icons` / `action` / `options_ui` / `background` 引用的每个文件路径都真的在包里 —— 这条能直接拦住 `Couldn't load icon ... specified in action.`；
6. 声明了 `default_locale` 就必须有 `_locales` 目录（配套检查）；
7. 必需文件齐全（`options.html` / `background.html` / `background-script.js` / `native.js` …）；
8. 每个图标都是有效 PNG（魔数校验，附带大小）+ 全部条目 CRC 校验通过，确认解压出来的字节和打包前一致。

**`audit-extension.js`** —— 防「加载时 manifest 校验不过」和「运行时引用 404」，按 Chromium 加载扩展的实际校验顺序分四组，共 33 项：

| 组 | 覆盖 |
| --- | --- |
| A 包结构 | `_` 开头名、空目录、`__MACOSX`/`.DS_Store` 残留、Windows 保留设备名、非法字符 |
| B manifest 字段 | 必填字段、`manifest_version===3`、`version` 段数与取值、MV2 遗留字段、`background` 不能同时有 `scripts` 与 `service_worker`、`action` 与 `browser_action` 不共存、CSP 不含 `unsafe-inline`/`unsafe-eval`/远程源、权限全在 MV3 白名单 |
| C 引用完整性 | `icons`/`default_icon`/`default_popup`/`options_ui.page`/`service_worker` 全部存在且是有效 PNG、HTML 内 `src`/`href` 相对引用能解析、`importScripts` 目标存在、JS 语法合法、无 0 字节空文件 |
| D 运行期隐患 | 是否依赖 `chrome.i18n`（决定 `default_locale` 能不能删）、扩展页无内联 script、无外部 http 资源、service worker 不直接操作 `document`、无构建脚本混入 |

用法：`node audit-extension.js [扩展目录]`（默认 `../floccus-via`），有 FAIL 时退出码为 1，可以接进 CI。

回归脚本（拿真实的两份书签文件跑读写一致性 + 幂等校验）：

```bash
cd floccus-src
npx tsc src/entries/via-check.js --outDir dist/via-check-tsc \
    --module commonjs --target es2019 --esModuleInterop --allowJs --skipLibCheck
cp package.json dist/package.json
VIA_FILE="E:/Users/xiaom/Downloads/坚果云bookmarks.html" \
FLOCCUS_FILE="E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html" \
    node dist/via-check-tsc/entries/via-check.js
rm dist/package.json
```

预期输出 26 项全部 `PASS`，最后打印 `ALL PASS`。

## 九、跟随上游 floccus 更新（会不会白改？）

**简短回答：不会白改。** 这套改动是「在既有函数里加一条 via 分支 + 加几个字段/选项」，不是重写 floccus，所以上游发新版只需要**合 + 跑自检**，不是重做一遍。

### 改动到底有多大

```
src/lib/serializers/HtmlVia.ts        +138  （纯新增插槽，不在冲突面上）
src/lib/serializers/Html.ts           +201  -36  （其中 via 逻辑仅 6 个 VIA-HOOK）
src/lib/adapters/WebDav.ts             +45
src/lib/native/I18n.ts                 +40  -12
src/ui/components/OptionsWebdav.vue    +39
manifest.json                           +4   -3
html/background.html                    +5   -1
src/lib/Tree.ts                         +6
+ 5 个中文语言包补词 + 5 个自检/打包脚本
```

关键在于**改动是"长出来"的，不是"改掉"的**：`serialize()/_serializeFolder()/parseDL()` 里多一个 `if (via)` 分支，`Folder` 多一个 `viaRootName` 字段，`getDefaultValues()` 多两个选项。上游若动了同一个函数，多半是并排的两段代码，冲突也只是一两处，不是整段互换。

更要紧的是**这 201 行里有一半现在根本不在冲突面上**：`HtmlVia.ts` 是新增文件，上游不存在它，怎么更新都不会撞；`Html.ts` 剩下那 ~100 行 via 代码（6 个 hook）还都被 `VIA-HOOK` 注释标了名字，合并时一眼能认出来。详见第十节 Q2。

### 同步流程（就三步）

```bash
cd floccus-src
node sync-upstream.js      # ① 体检，只读、不动仓库
```

脚本会做三件事（都在 merge 之前告诉你）：

1. 列出上游新增了哪些提交、动了哪些文件；
2. 交叉比对「我改过的 13 个文件」——没被上游碰到的直接可以 merge，碰到的标成高/中风险并点名；
3. 跑 `git merge-tree` dry-run，把**真会冲突的文件**提前列出来（本机 git ≥ 2.38 才支持，不支持就跳过第 3 步，看第 2 步足够）。

```bash
git merge origin develop   # ② 正常合入
# 然后固定六步，别跳顺序
npx gulp build                 # 编译，看 TS 报不报错
node check-i18n.js             # 中文文案漏没漏
node check-zip.js              # zip 合规
node audit-extension.js        # 扩展合规（期望 33 PASS / 0 FAIL）
npx webpack --config webpack.via-check.js
VIA_FILE="..." FLOCCUS_FILE="..." node dist/via-check/bundle.js   # 26 项回归
node pack-for-edge.js          # 重新打 ../floccus-via 与 zip
```

> 回归脚本必须带 `VIA_FILE` / `FLOCCUS_FILE` 两个环境变量（指向真实的 Via 导出和 floccus 导出），否则脚本会因为 `readFileSync(undefined)` 直接崩。

### 两个要记住的坑

**1. `Html.ts` 里的 NUL 分隔符必须写成转义形式。**
`stableId()` 用 NUL 字符拼 key，如果源码里存的是**真 NUL 字节**，git 会把整个 `.ts` 判成二进制文件 —— diff 变成一行 `Bin 3786 -> 13501 bytes`，21 个 hunk 塌成一次整体替换，同步上游时你根本看不到逐行冲突在哪。所以源码里必须写成 `\u0000`（反斜杠 + 6 个字符）而不是按一下 Ctrl+Enter 塞进去的空字节。两者运行效果完全一样，已确认改动前后 26 项回归全过。

**2. `manifest.json` 的版本号冲突是必然的，别折腾。**
上游发版会改 `version`，我这边为了商店合规把它写成 `5.11.1.0`（四段）。合并时必然打架，直接保留上游的版本号、保留我们的 `name: floccus-via` 就行，其余字段以我的为准。

### 上游动了语言包怎么办

上游在 Transifex 上补了新文案 → 中文包可能又缺词。跑一遍 `node check-i18n.js` 看缺口，按它给的清单补；`zh_CN` / `zh-Hans` 缺了会自动借道 `zh` 兜底（见第七节 `I18n.ts`），短期不会露英文，但长期还是补上更好。

### 想更稳？也可以反向操作

如果你不想跟上游走，另一种做法是**把上游 tag 打回来做基线**：每次同步后把改动 commit 成一个 `via: xxx` 的提交，冲突面就永远固定在这一个提交上，不会越积越多。目前因为改动量小、脚本够用，还没到必须这么做的地步。

## 十、两个常见疑问

### Q1：不开 Via 兼容开关，同步格式还是官方原版吗？

**是，逐字节一样。** 这个结论是量出来的，不是"看代码应该没问题"：

1. `git worktree add --detach .upstream-wt 944fc3e` 取出上游 v5.11.1 纯净源码，把 `node_modules` 做成 junction 接进去，放同一个入口、同一份输入文件；
2. 上游原版代码跑一遍非 via 序列化 → `sha256 33ea98f5…` / 39147 字节；
3. 本分支（含全部 Via 改造）跑同一入口 → **`sha256 33ea98f5…` / 39147 字节**。

字节数和 sha256 完全一致。开关确实有作用，两种模式输出实测不同：

| | 开头 | 节点写法 |
| --- | --- | --- |
| 官方（开关关） | `<DL><p>` | `<DT><A HREF="…" TAGS="" ID="59">…</A>` |
| Via 兼容（开关开） | `<!DOCTYPE NETSCAPE-Bookmark-file-1>` 全套头 | `<DT><H3 ADD_DATE="1791072267">导航页</H3>`，无 `ID` / `TAGS` |

代码上也对得上：`Html.ts` 里每处 via 改动都包在 `if (via)` 里（`DEFAULT_OPTIONS.viaCompatible = false`），`WebDav.ts` 里 `if (!data.via_compatible) return { viaCompatible: false }` 直接走原路径，`Tree.ts` 的 `viaRootName` 也只在 via 分支赋值。

**这个指纹已经写成回归了**：`node check-official-compat.js`。以后每次同步上游都跑它，一旦不对等直接 FAIL，告诉你到底是「上游改了官方格式」还是「你的改动越界了」。

### Q2：能不能改得更少，方便一直跟着官方走？

**已经做成你要的"插庄"了**，而且是分两层落地的：

**第一层｜Via 逻辑全部搬进独立插槽 `src/lib/serializers/HtmlVia.ts`（138 行）。**

- 稳定哈希 ID（murmurhash3 + 双种子）、ADD_DATE 缓存与 6 小时 TTL、根包装文件夹识别、Via 文件头、属性/文本转义 —— 全部在这里。
- 这个文件是**纯新增**，上游 floccus 本来没有它，所以**同步上游时它永远不会起冲突**。
- `Html.ts` 里只剩 6 个 hook 点，全部用 `VIA-HOOK n/6` 注释标了出来（搜索 `VIA-HOOK` 就能定位）。
- 效果：`Html.ts` 从 354 行降到 287 行，对上游的净增从 +268 降到 +201，且这 201 行里有 138 行根本不在冲突面上。

**第二层｜同步上游时只看 6 个 VIA-HOOK。**

`Html.ts` 文件头写了合并规则，一句话概括：

> 除了这 6 处，任何其他冲突都直接接受上游版本，别去动 Via 逻辑。

这 6 处只有两种可能需要手动处理：①上游改了函数签名（把我们的可选参数合并回去，默认值仍是"不传 = 官方行为"）；②上游改了渲染/解析主体（看我们的分支能否并排保留）。

**为什么不做到"Html.ts 零改动"？**

这条路技术上走得通，但要把 `if (via)` 的**显式分支**换成**字符串后处理**：解析侧对官方产出的树做后处理（提升根层级、重写 ID），输出侧对官方渲染结果做正则替换（`ID="x" TAGS="y"` → `ADD_DATE="d"`）。

能省下最后 6 个 hook，代价是三件更麻烦的事：

1. **正则改 HTML 属性很脆。** 上游哪天改了输出格式（换引号、换属性顺序、启用 HTML 转义），我们的替换可能静默漏改或改错 —— 这类 bug 的表现是"书签同步开始乱"，排查成本远高于一个 git 冲突。
2. **ADD_DATE 的来源会变脏。** 官方 `parseNode` 不读 `ADD_DATE`，后处理方案里要么从原始 HTML 正则抓（又一层正则），要么用哈希派生一个假时间戳（可稳定，但丢了真实添加时间）。
3. **显式分支是文档，隐式后处理是黑话。** 半年后没人敢动 `HtmlVia.ts`，因为它和 `Html.ts` 之间靠"输出格式默认长这样"隐式耦合着。

判断标准：**等 `sync-upstream.js` 频繁报「上游改了 `Html.ts` 主体」、`check-official-compat.js` 开始 FAIL、或 6 个 hook 里有 3 个以上开始反复冲突**，那时候再考虑升级到这条路。现在这套是「冲突面最小 + 每一处冲突都看得见」。

**一条长期纪律**：每次同步完上游，`git commit` 时统一用 `via: 跟上 floccus vX.Y.Z` 这种一眼能认出是本地改动的提交信息。这样无论仓库多脏，一句 `git diff` 就能把"我们改的"和"上游带来的"分清楚，回滚也只回得掉自己的那部分。

## 十一、同步上游后的验收清单（每次照着走）

这一节是「人肉确认」部分：第十一章前面的脚本都是自动的，但有几处**只有人是判断得准的**。同步上游后先跑 `node sync-upstream.js` 拿到冲突清单，再照本节逐项过。

当前基线：**上游 `944fc3e`（v5.11.1，sha `944fc3eadccc455c131dd06032f2d2ca17615c21`）**。下一版基线请跟着更新这里的记录。

### 11.1 这份文档不会被上游覆盖（为什么放心）

`README.via.md` 是 **fork 专属文件，上游 floccus 仓库里根本不存在它**，所以：

1. `git merge` / `git rebase` 只会动「两边都有的文件」，上游没有 `README.via.md` → 不会冲突、不会被删；
2. 它已经被 `sync-upstream.js` 列进 `VIA_PROTECTED_FILES`，脚本启动时会校验这批文件还在不在，少一个就报警；
3. 唯一可能被覆盖的路径：**把扩展产物目录 `../floccus-via/` 提交进仓库**（里面躺着 `pack-for-edge.js` 复制过去的 `README.md`）。所以这条纪律要守住——**产物目录永远不入 git，只入 `.git/info/exclude`**。

双保险：本文件的历史副本在 fork 仓库的 `my-viasync` 分支上，误删了随时能找回来。

### 11.2 P0：必跑脚本（任一 FAIL 就不许打包）

按这个顺序跑，别跳：

```bash
cd floccus-src
npx gulp build                 # ① TS 编译
node check-official-compat.js   # ② 官方格式对等：必须 sha 33ea98f5… / 39147 字节
node check-i18n.js              # ③ 中文四包缺 0
node check-zip.js               # ④ zip 合规（176 条目 CRC）
node audit-extension.js         # ⑤ 扩展合规（33 PASS / 0 FAIL）
node pack-for-edge.js           # ⑥ 重新打 ../floccus-via 与 zip
```

Via 回归要带真实书签文件（脚本会 `readFileSync(undefined)` 崩掉）：

```bash
npx webpack --config webpack.via-check.js
VIA_FILE="E:/Users/xiaom/Downloads/坚果云bookmarks.html" \
FLOCCUS_FILE="E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html" \
node dist/via-check/bundle.js     # 26 项全 PASS
```

### 11.3 P1：必须人工确认的修改点（按危险度排序）

这一节是本节的核心。同步上游后，**只要 `git merge` 后这些文件有变动，就要逐项过一遍**。

| # | 位置 | 上游动了会怎样 | 怎么确认 | 怎么办 |
|---|---|---|---|---|
| **P1-1** | `src/lib/murmurhash3.ts` | **最危险。** `HtmlVia.ts:28` 直接 `import { murmurhash3_32_gc } from '../murmurhash3'`，配上我们自己的双 seed `0x5eeda11` / `0x5eedb22` 生成 Via 稳定 ID。这个文件的算法输出一变，手机 Via 上**已有全部书签的 ID 会被重新算一遍** → 同步时整棵树被判成"全变了"，书签位置会乱、触发全量重建 | `git diff origin/develop -- src/lib/murmurhash3.ts` 看是不是空 | murmur 是标准算法，正常不会动。真动了就保留上游版（我们本来就没改它），但**同步后必须实地完整跑一次双向同步**，确认 Via 端书签没跑位 |
| **P1-2** | `src/lib/serializers/Html.ts` | 我们的 6 个 `VIA-HOOK` 全在这。上游改 `serialize()` / `_serializeFolder()` / `parseDL()` 主体会打架 | `grep -n VIA-HOOK src/lib/serializers/Html.ts` 必须还是 **6 个**，而且顺序别乱 | 除这 6 处，其它冲突**一律接受上游版本**；只把 `if (via)` 分支并排贴回去 |
| **P1-3** | `src/lib/adapters/WebDav.ts` | Via 的两个配置挂在这：`via_compatible` / `via_root_folder`（51、53 行的默认值）+ `getHtmlSerializerOptions()`（96 行）里的短路 `if (!data.via_compatible) return { viaCompatible: false }` | 上游改了 `getDefaultValues` / `getHtmlSerializerOptions` 的签名 | 把我们的两段并回去。**这条短路必须还在**，否则不开 Via 开关也会走兼容路径 |
| **P1-4** | `manifest.json` | `version` 冲突是必然的（上游发版会改，`name` 是我们自己的） | `version` 跟 `name` 同时出现在 diff 里 | 保留上游版本号 + 我们的 `name: floccus-via`；顺手确认 **`tabGroups` 权限还在**（是我们补的，官方 Chrome manifest 有，缺了标签页分组整片拿不到） |
| **P1-5** | `src/ui/components/OptionsWebdav.vue` | Via 配置卡片在这（checkbox + 根文件夹输入框） | 上游改设置页 → 卡片被冲掉 | 补回 `via_compatible` 开关与 `via_root_folder` 输入框 |
| **P1-6** | `src/lib/native/I18n.ts` | 我们改了回退链：逐 key 回退 + 同语系借道（`zh_CN`/`zh-Hans` 缺词借 `zh`） | 上游动 I18n 会冲突 | 保留 `getMessageChain` 与 `zh-Hans` 借道，否则 Via 那几个新文案会露英文 |
| **P1-7** | `src/lib/adapters/Caching.ts` | `WebDav.ts:99` 从 `this.bookmarksCache.viaRootName` 读根文件夹名。上游重构缓存结构 → 根名读不到 | 表现是 Via 端"单一根包装文件夹"识别失效（手机端顶层对不上电脑端） | 把 `viaRootName` 挂回新的缓存对象上 |
| **P1-8** | `src/lib/Tree.ts` | 我们只加了可选字段 `viaRootName?: string`（410 行） | — | 可选字段，上游怎么改都接得上，基本不冲突 |
| **P1-9** | `_locales/*` 五个中文包 | 上游在 Transifex 加新文案 → 中文缺词 | `node check-i18n.js` 报缺口 | 按清单补；`zh_CN`/`zh_Hans` 有借道兜底，长期还是补上 |
| **P1-10** | `html/background.html` | 我们删了 `../../lib/chrome-promise.js` 这个死引用 | 上游重加回引用会怎样 | 只要没人引用它就不影响打包（曾经因为它导致安装失败） |

### 11.4 P2：顺手看一眼（不动也不会立刻出事）

- **`android/` 和 `ios/` 下 8 个文件在 `git status` 里永远是 `M`** —— 这是 Windows 行尾噪声（`core.autocrlf=true` 且仓库没有 `.gitattributes`），实测 8 个文件全部是纯 CRLF/LF 差异、**零语义改动**。所以提交时**必须精确 `git add` 指定文件，永远不要 `git add -A`**，否则就是把 8 个全文件行尾改动灌进历史。
- **`floccus-via.zip` / `floccus-via.crx`** 是本地产物，已写进 `.git/info/exclude`（本机专属、不进仓库）。换机器要重新生成，别提交。
- **`key.pem`**（CRX 私钥）已被上游 `.gitignore` 忽略。别提交，更**别换**——换了私钥，Chrome 眼里就是另一个扩展，之前装的 floccus-via 再也更新不上。
- **`dist/` 里的 `via-check` / `official-check` / `via-check-tsc` 三个目录**是校验产物，被 `pack-for-edge.js` 的 `SKIP_DIRS` 挡在包外，本地占 6 MB 属正常。
- 我们新增的全部文件（`HtmlVia.ts`、`check-*.js`、`pack-*.js`、`src/entries/via-check.js`、`webpack.via-check.js`、**本文件**）**上游都不存在 → 永远不冲突**，唯一要盯的是别被误删。

### 11.11 Via 模式下为什么看不到「密码短语」和「文件格式」

**这是有意藏起来的，不是界面坏了。**

Via 只能读**未加密的 Netscape 格式 HTML**。如果给 Via 账号加密，`WebDav.ts` 会把整个文件换成 `{ciphertext, salt}` 密文；如果选 XBEL，Via 根本读不了。所以这两项和 Via 是互斥的，勾上 Via 就自动藏掉：

| 界面位置 | 行为 |
| --- | --- |
| **新建账号向导**（WebDAV） | 勾「Via 浏览器兼容」→ 路径预填 `Via/bookmarks.html`、格式锁定 HTML、格式选择框消失 |
| **账号设置页（Via 账号）** | 密码短语、文件格式两块**隐藏**；Via 卡片可见但开关锁定；附说明 |
| **账号设置页（普通 WebDAV）** | 密码短语、文件格式**照常显示**，且**看不到 Via 卡片**（与官方原版一致） |
| **其它适配器**（Git / Google Drive / Dropbox…） | 完全是官方原版设置页，无任何 Via 元素 |

**开启 Via 的唯一入口是新建账号向导**。这不是偷懒，而是刻意的：开启需要三件事同时改（路径、格式、加密），一旦允许中途切换，就得为"格式与实际内容对不上"写一堆补救逻辑，同步失败时用户看到的还是一堆英文报错。整块隐藏 = 没有中间态。

**想换回官方格式**：删除这个账号，新建一个不勾 Via 的。仅此一条路。

> **为什么不做成「置灰」？** 置灰要改 `OptionPassphrase.vue` / `OptionFileType.vue` 两个上游组件本体（各加 `disabled` prop），等于为我们的功能去动无关文件、增加两个长期冲突点。隐藏只需在调用处加 `v-if`，冲突面留在 Via 区域自己那一片。

> **为什么 Via 卡片也整块隐藏（而不是保留一个可点的开关）？** 因为它**不能是可切换的**。一旦普通账号能在设置页勾上，就会出现"勾上了但路径和格式没跟着改"的中间态——`via_compatible=true` 而 `bookmark_file_type` 还是 xbel，产出的是 Via 读不了的 XBEL，而且不报错。开启入口唯一化是唯一能避免这个状态的写法。

**涉及的代码锚点**（同步上游后照着查这几处）：

```bash
grep -n "VIA-COMPAT" src/ui/views/NewAccount.vue      # 应有 2 处（勾选框 + 预填方法）
grep -n "VIA-HIDE"   src/ui/components/OptionsWebdav.vue  # 应有 2 处（密码 + 格式）
grep -n "VIA-NOTE"   src/ui/components/OptionsWebdav.vue  # 已启用时的说明
grep -n "via_compatible" src/lib/adapters/WebDav.ts  # 兜底必须还在
```

**为什么向导页的 `onCreate` 里有那一行 `...(this.via_compatible && {...})`**：`onCreate` 是白名单式传参，每个字段都要显式放行。不写这一句，勾选只停在界面上、**存不进账号**，设置页就永远读不到 `via_compatible`。这是本方案最容易踩空的一处，改动时务必带上。

新增文案（`node add-via-locale.js` 可重复执行，幂等，只新增不覆盖）：
`DescriptionViaCompatibleNoEncrypt`（向导提示）、`DescriptionViaLocked`（设置页说明）。

> ⚠️ 语言包目录名是 **`zh-Hans`（连字符）**，写成 `zh_Hans` 会被静默跳过。脚本里已注明。

### 11.5 一页速查卡

```bash
# 同步前：体检，只读
node sync-upstream.js

# 同步中：git merge origin develop
# 同步后：撞到 11.3 表格里任一文件 → 逐项过

# 六步自检（顺序别乱）
npx gulp build && node check-official-compat.js && node check-i18n.js \
  && node check-zip.js && node audit-extension.js && node pack-for-edge.js

# Via 回归（必须带环境变量）
npx webpack --config webpack.via-check.js
VIA_FILE="…/坚果云bookmarks.html" FLOCCUS_FILE="…/floccus-…export.html" \
  node dist/via-check/bundle.js

# 冲突定位
grep -n VIA-HOOK src/lib/serializers/Html.ts      # 必须 6 个
grep -n tabGroups manifest.json                   # 必须在
git diff origin/develop -- src/lib/murmurhash3.ts # 必须为空

# 红线自查：绝不能往上游提 PR
node sync-upstream.js 2>&1 | head -2
#   必须看到「未向上游提交任何 PR」+「origin 的 push 已阻断」

# 远端状态自查（认 sha，别信 push 输出的 "Everything up-to-date"）
git ls-remote --heads fork | grep my-viasync
```

### 11.6 根 README 导引卡：GitHub 首页永远是中文的

打开这个 fork 的仓库首页，看到的是**我们前置的中文导引卡**（常说的"门面"），不是上游那份英文 README。

```
README.md            ← GitHub 首页显示这个：导引卡 + 上游原文（keep-ours 锁死，上游改也顶不掉）
README.upstream.md   ← 上游 README 的归档副本，用来 diff 上游改了没
README.via.md        ← 完整中文说明（本文件）
README.upstream.md / README.md 的原文归档
patch-readme-head.js ← 生成导引卡的脚本（幂等）
```

**为什么没直接把 README.md 换成导引卡**：上游 README 里的安装说明、徽章、捐赠链接都有价值，硬覆盖就永久失去可追溯性。所以做法是"前置导引卡 + 保留原文"，两边都要。

**怎么保证同步上游后首页不变回去**？`.gitattributes` 里挂了 merge driver：

```gitattributes
README.md merge=keep-ours
README.upstream.md -text
```

- `merge=keep-ours` → 任何一次 `git merge origin develop`，`README.md` 都取本地版本，**零冲突自动合并**，上游英文永远上不来。
- 实测过：造一个"上游真改了 README"的分叉分支来合并，导引卡完好、上游那行文案一次都没混进来。
- driver 是 `touch %A`（不是 `cp %A %A` —— 后者自己读自己会报错，git 会当成合并失败，这个坑踩过）。driver 实体在 `.git/config`，换机器 clone 后要补一句：

  ```bash
  git config merge.keep-ours.driver "touch %A"
  git config merge.keep-ours.name "always keep our README.md"
  ```

**上游 README 更新了怎么办**：跑 `node sync-upstream.js --archive-readme` 刷新归档，然后 `git diff README.upstream.md` 看上游改了什么，再决定要不要把新内容并进 `README.md`（导引卡末尾那句"完整说明"不用手改，脚本自动管）。不带参数跑只体检、不写文件。

⚠️ **一个真实踩过的坑**：比对归档时必须吃掉行尾（`\r\n` → `\n`）。本机 `core.autocrlf=true`，上游 blob 是 LF、worktree 归档是 CRLF，直接字符串比会**永远判定"上游变了"**，每次同步都误报。脚本里已归一化，`README.upstream.md` 也标了 `-text` 防止被反复转换。你本地如果遇到归档莫名显示 modified，先 `git diff README.upstream.md` 看是不是空的——是空的就是 stat 缓存，别 `git add -A` 把它灌进历史。

### 11.7 默认分支是 my-viasync（分支约定，别搞反）

fork `xiaobai860/floccus-via` 的**默认分支已设为 `my-viasync`**，不是上游那个 `develop`。所以打开首页、clone 默认、`git pull` 默认拿到的都是我们这一支。

**三条分支/远端各管什么**：

| 名字 | 指向 | 说明 |
| --- | --- | --- |
| `fork/my-viasync` | 我们的 fork | **默认分支、我们的主线**，所有 via 改动都在这 |
| `fork/develop` | 我们的 fork | 停在 `944fc3e`（上游原版），留着当"未改过的对照"，一般不动 |
| `origin/develop` | `floccusaddon/floccus` | **上游**，同步脚本的合并目标 |

**⚠️ 本地 remote 约定（搞反了同步会静默失效）**：

```
origin → floccusaddon/floccus.git   ← 上游
fork   → xiaobai860/floccus-via.git  ← 自己
```

`node sync-upstream.js` 每次启动都会校验这条（输出 `→ origin 指向上游 floccusaddon/floccus，引用 origin/develop 正确`）。如果 `origin` 指到自己的 fork，它会直接报 ⛔ 并给出修正命令——因为那种情况下 `origin/develop` 就是上游原版，而我们本就在它之上，脚本会判"完全一致"直接退出，**看起来正常，实际什么都没同步**。

**clone 这个 fork 的正确姿势**（clone 完 `origin` 默认是自己，得手动对调）：

```bash
git clone https://github.com/xiaobai860/floccus-via.git
cd floccus-via
git remote rename origin fork                      # 自己的改名 fork
git remote add origin https://github.com/floccusaddon/floccus.git
git fetch origin
# 之后：node sync-upstream.js   →  必须看到「origin 指向上游」才正常
```

**另一个限制要知道**：`.gitattributes` 的 `merge=keep-ours` driver 是**本机行为**（定义在 `.git/config`）。GitHub 网页上的 "Sync fork" 按钮和 PR 合并走服务端，**不执行这个 driver**。现在 `my-viasync` 是上游 `944fc3e` 的快进后继，点 Sync fork 是快进、无冲突、首页不受影响；但将来上游真改了 `README.md` 时，网页端合并仍可能报冲突——那种情况按 11.6 的办法在本地 `git merge origin/develop`（走 keep-ours，零冲突自动合并）再推。

### 11.8 分支保护：默认分支禁 force push / 禁删

`my-viasync` 上挂了一条 GitHub ruleset（名字 `protect-my-viasync`，id `24441483`），只含两条规则：

| 规则 | 效果 |
| --- | --- |
| `deletion` | 任何人**不能删**这个分支（包括 GitHub 服务端） |
| `non_fast_forward` | 任何人**不能 force push**（不能改写已推送的历史） |

**没有设 `required_pull_request`、也没有 bypass 名单**——所以我们的日常流程一点没变，`git push fork develop:my-viasync` 照旧直推（实测通过：`9701f87f..2bcf70a5` 正常推送）。GitHub 网页上的 **Sync fork** 想硬改写历史也会被同一套规则挡住。

**⚠️ 这条规则有一个反直觉的后果，记住**：

> **一旦某个提交推上去了，就再也删不掉了。**

想撤销一个已推送的提交，正确做法是**再推一个新提交把它盖掉**，不是 force push。比如误推了测试提交 `2bcf70a5`（本地已 `git add` 回退掉），远端那个 sha 就永久留在历史里了，只能靠后续提交覆盖。

这正是我们要的：**历史只能前进，不能被抹掉**。但也意味着推送前要多看一眼 `git status` 和 `git log --oneline -3`。

**实战案例（真踩过，不是吓唬）**：给分支做保护验证时，我推了一个测试提交 `2bcf70a5` 到 `README.upstream.md`，发现普通推送不受影响后就在本地 `git reset --hard` 把它删了。结果远端那个提交**删不掉了**——本地和远端从此分叉，普通推送被拒（`non-fast-forward`），force push 又被 ruleset 禁，**卡死**。

正确解法（两步，全程无 force）：

```bash
git fetch fork my-viasync
git merge --no-edit fork/my-viasync   # ① 先合并，恢复快进关系（内容无所谓）
# ② 再用新提交把测试痕迹盖掉
git commit -am "chore: 清除验证留下的标记"
git push fork develop:my-viasync     # ③ 正常推送，success
```

顺带一条判断：**「推之前先想好能不能撤」**。保护规则启用后，验证性提交要么别推，要么推之前就想好怎么盖。

**万一真要改写历史怎么办**（比如误推了含密钥的提交）：

```bash
# 先临时解除 non_fast_forward，推完立刻恢复
curl -X DELETE -H "Authorization: token <PAT>" \
  https://api.github.com/repos/xiaobai860/floccus-via/rulesets/24441483
# …做你的 force push…
# 然后重建（ruleset.json 见 git 历史，或重新 POST 一次，配置见 11.7 提到的字段）
```

删除分支还有第二道内置防线：GitHub 本身就不允许删除默认分支（报 `Cannot delete the default branch`），跟 ruleset 无关。

### 11.9 红线：绝不能向上游提交任何东西

> **floccus-via 是个人 fork。所有 Via 改动只留在自己这边，一个 PR / Issue 都不往 `floccusaddon/floccus` 提。**

这不是"尽量避免"，是**技术上已经堵死**的：

**① 上游的 push 地址已被阻断**（`git remote set-url --push`）：

```
origin  https://github.com/floccusaddon/floccus.git (fetch)   ← 能拉
origin  DISABLED://never-push-to-upstream-floccusaddon (push)  ← 推不动
```

实测 `git push origin develop` → `fatal: remote helper 'DISABLED' aborted session`。**手滑也推不上去**，而 `git fetch` 照常能用、同步脚本不受影响。

**② `sync-upstream.js` 每次启动都会自查**并在控制台打印：

```
→ ✅ 未向上游提交任何 PR（已核查上游 100 个 PR，无 xiaobai860）
→ origin 的 push 已阻断（DISABLED://...），手滑也推不上去。
```

如果哪天它打出 `⛔⛔⛔ 检测到你向上游提了 N 个 PR`，立刻去这个地址关掉：
`https://github.com/floccusaddon/floccus/pulls?q=is%3Apr+author%3Axiaobai860`

查不到时它会显式说"**无法确认**"并给出上面的手动核对地址——**不会假装安全**（这是特意设计的：假阴性比不检查更危险）。

**③ 唯一允许的推送目标只有 `fork`**：

```bash
git push fork develop:my-viasync   # ✅ 唯一正确的推送方式
git push origin develop            # ❌ 已阻断，会失败
```

推之前习惯性看一眼 `git remote -v`：写远程的名字应该是 `fork` → `xiaobai860/floccus-via`。**记住往 `fork` 推，不往 `origin` 推。**

> ⚠️ **换机器 clone 后这个阻断会丢失！** push URL 记在 `.git/config` 里，**不随仓库走**。
> 新机器上第一次用之前先补上：
> ```bash
> git remote set-url --push origin "DISABLED://never-push-to-upstream-floccusaddon"
> ```
> 忘了也不要紧——`sync-upstream.js` 每次启动会检查这件事，发现没阻断会打 `⛔⛔⛔` 并把命令打给你。

### 11.10 推送时别再弹那个英文小窗

如果你以前每次 `git push` 都弹一个 **Credential Helper Selector** 小窗（选项 `<no helper> / manager / wincred`、界面是英文、小屏显示不全得全屏才能点），那不是你操作有问题，是环境默认配置在作怪。

**根因**：git 推送成功后要**存凭据**，这一步会调用 credential helper。而 WorkBuddy 内置的 PortableGit 在系统级 `etc/gitconfig` 里预置了 `helper = helper-selector`——就是那个弹窗。它每次都弹，跟你以前有没有选过 "manager" 无关（那条记录在用户级，系统级那行仍会先触发）。

**已在本机禁用**（`credential.helper` 设为空值——git 规则里空值会重置整条 helper 链，正好压掉系统级那行）：

```bash
git config --global --unset-all credential.helperselector.selected
git config --global credential.helper ""     # 所有仓库生效
```

**验证过的现象**：改完之后——无凭据推送直接报 `Authentication failed`（不再有任何弹窗）；带 token 的真实推送（`77b4ed48..1bfb45ff`）一次成功、**全程零弹窗**。

**副作用（要知道）**：凭据助手被完全禁用，以后**任何** git 操作如果没带凭据会直接失败，不会再有交互式弹窗兜底。这对我们没影响——项目所有推送都用「token 内联 + 后台任务」的方式。但你如果要**自己在终端里** `git push`，得手动带 token（`https://<user>:<token>@github.com/...`）或改配 SSH key。

**为什么不汉化那个窗口**：GCM 二进制里没有中文语言包（`zh-CN` 资源数为 0），而且它是第三方程序，不该去改。禁用之后**根本不会弹窗**，比汉化更干净。
