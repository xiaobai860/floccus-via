# floccus-via（Edge 版）

在 floccus 官方版基础上做了 **Via 浏览器书签格式兼容** 的分支，用于在 **Windows Edge（Chrome 内核浏览器）** 与 **手机 Via 浏览器** 之间通过坚果云 WebDAV 里的 `bookmarks.html` 双向同步书签。

官方版 floccus 读不懂 Via 导出的书签文件（Via 那棵树结构跟 floccus 的「书签栏 / 其他书签」对不上，且文件里只有 `ADD_DATE`、没有 floccus 自己的 `ID` / `TAGS`；Via 每次重传还会把 `ID` 抹掉），一同步路径就层层错位，越同步越乱。本分支把读写两端都改成 Via 的原生 Netscape 格式，两边说的是同一个"方言"，不会再互相污染。

> 上游项目：https://github.com/floccusaddon/floccus （MPL-2.0），本次改动是追加式的，没有改写官方的同步算法。

---

## 一、安装（Edge / Chrome，装法完全一样）

两个浏览器在这一步**没有任何区别**，都是标准 MV3 扩展。只有一种推荐装法：

### 装法：加载已解压的扩展程序（推荐，也是唯一的推荐）

1. 打开 `edge://extensions/`（Edge）或 `chrome://extensions/`（Chrome）。
2. 打开右上角 **「开发者模式」**开关。
3. 点 **「加载已解压的扩展程序」**，选择扩展目录 `D:\xiaom\Documents\WorkBuddy\浏览器扩展\floccus-via`（**选这个文件夹本身**，别选里面的 `dist`）。
4. 列表里出现名为 **floccus-via** 的条目即成功；点图钉固定到工具栏，点图标 → **选项** 进去配置。
5. 以后改了代码，在扩展卡片上点 **「刷新」** 就生效，不用重装。

> **为什么不用拖 zip**：zip 装进去后是一个「已打包」状态，改一次代码就得重新打一次包再装。加载解压目录则只要覆盖文件夹内容 + 点刷新。
> **为什么不用 crx**：Chrome 124+ / Edge 已经不接受拖 crx 安装了，本项目 2026-10 起也不再产出 crx（见第八章）。

### 这个 zip 到底是什么

`floccus-src/floccus-via.zip` 是**交付物**（用于备份、传给别人、或提交到 Edge 侧商店），日常自用不必用它。要装的话解包后同样走上面第 3 步。

> zip 里不含任何以 `_` 开头的目录/文件名（打包时不带 `_locales/`，语言包被编译进 `dist/js` 的 chunk 里了），所以解压后加载不会被拒。

### 扩展 ID 的区别（只影响"以后怎么更新"）

- **加载解压目录**：ID 由该目录的绝对路径哈希决定（换目录 = 换 ID），以后更新只要**覆盖文件夹内容**再点「刷新」即可。
- 换目录或换浏览器时，浏览器会当成另一个扩展，需要重新装一次。

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

### 2. 在扩展里填（Via 兼容账号）

选项页 → 添加账号 → 适配器选 **WebDAV**，向导会走 5 步：

| 步骤 | 内容 | Via 相关的操作 |
| --- | --- | --- |
| 1 | 选择适配器 | 选 **WebDAV 分类** |
| 2 | 配置标签 | 随手起名，如「手机 Via」 |
| 3 | **同步文件夹设置** | ⭐ **在这里勾「Via 浏览器兼容」**（在「预设服务器」和「WebDAV URL」之间），填 URL / 用户名 / 密码 |
| 4 | 文件名与格式 | *书签文件* 已自动填好、*文件类型* 已锁定不用管 |
| 5 | 同步选项 | 保持默认 |

**第 3 步里勾上「Via 浏览器兼容」之后，同一页会发生三件事**：

- **「密码短语」输入框立刻消失** —— 这一条是必须的：填了密码整个文件会被加密成密文，Via 浏览器根本读不出来
- *书签文件*（第 4 步）自动填成 `Via/bookmarks.html`（Via 自己的目录布局）
- *文件类型*（第 4 步）整块**消失**，格式锁定为 HTML（XBEL 是 floccus 自己的格式，Via 读不了）

> 勾选框特意放在 URL **之前**、密码短语**之后靠上**的位置：它决定了这套配置是「Via 模式」还是「官方模式」，是整个表单的前提，不该藏在最下面。

**这个勾选只能做一次**。开启后想换回官方格式（XBEL / 可加密）**没有开关可关**，唯一办法是**删掉这个账号重新建一个不勾的**。原因见 [11.11 章](README.via.md)：开启需要三件事同时改（路径、格式、加密），允许中途切换就会产生"格式和实际内容对不上"的中间态，同步必失败。

**如果你是普通的 WebDAV 同步（不用 Via）**：什么都不勾，走完全官方的流程，文件类型可选 XBEL 或 HTML、可以设密码短语。Via 相关的一切都不会出现在你的设置页里。

### 3. 设置页里 Via 卡片长什么样

账号建好之后进设置页，Via 账号会多出一张 **「Via 浏览器兼容」** 卡片：

- ☑ **Via 浏览器兼容**：**已勾选且锁定不可取消**（灰色的就是不可改）
- 下面一行说明会告诉你「为什么密码和格式不见了、想换回官方格式只能删号重建」

> **这里曾经有一个「Via 根文件夹名」输入框，已删除。** 实测用户的真实 Via 文件（顶层是
> `Bookmarks Bar` / `Other Bookmarks` / `移动收藏夹` 三平级）根本不会触发「单一根包装」，
> 填了反而会让 floccus 在文件外面**强行再包一层**，Via 那边看到结构就变了。
>
> ⚠️ **但底层的自动机制必须保留**（`HtmlVia.ts` 的 `findSingleRootFolder` + `lastRootFolderName` +
> `ROOT_DATE_KEY`）：如果哪天 Via 把文件变成「整棵树包在一个根文件夹里」的形态（例如用户只留一个
> 顶层目录、或 Via 版本升级改了导出结构），那套机制会自动认出根名字并原样包回去，丢掉了就会
> **静默丢掉那层包装**。28 项回归里有一整组专门覆盖它，改动时别碰。

> 这一整块界面是**中文**，而且是直接写死在模板里的，**不经过语言包**。所以无论界面语言设成什么，Via 兼容区永远显示中文，不会出现"某几行变英文"的情况。

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

### ⭐ 最重要的一条：手机里建的书签，为什么电脑上可能看不见

**这是本项目最容易踩的坑，也是唯一一处「Via 允许、但电脑装不下」的地方。**

浏览器（Edge / Chrome）的书签根节点 `id='0'` 是**虚拟根**，它下面**只能有**三个固定文件夹：

| id | 显示名 |
|---|---|
| `1` | 收藏夹栏 Bookmarks Bar |
| `2` | 其他收藏夹 Other Bookmarks |
| `3` | 移动收藏夹 Mobile Bookmarks |

**你在 Via 里直接点「新建」时，Via 会把它放在根目录**，也就是会产生第 4 个同级节点（例如「测试目录」「测试书签」）。**电脑端没有地方放它** —— floccus 命中 `BrowserTree.createFolder/createBookmark` 里的这段逻辑：

```js
if (folder.parentId === this.absoluteRoot.id) {
  Logger.log('This action affects the absolute root. Skipping.')
  return          // ← 静默跳过，不报错、不提示
}
```

**后果**：同步会**一直静默跳过**它（详见下一节），所以**手机上明明有、电脑上死活不出现**，而且不会有任何报错提示你为什么没同步过来。

**✅ 正确做法**

| 想放哪 | 在 Via 里新建时要选 |
|---|---|
| 平时最常用的 | 收藏夹栏 |
| 归类存档 | 其他收藏夹 |
| 跟着手机走的 | 移动收藏夹 |

**永远不要在 Via 的根目录直接新建**（它允许你这么做，但电脑端接不住）。

**已经建错了怎么办**：去 Via 里把那些根级项目**删掉**（或移进三个固定文件夹下面），然后在 floccus 选项页点「立即同步」。

**✅ 它们会不会被同步"删掉"？不会，数据是安全的。**

代码上明确处理了这种情况（`Scanner.ts` 的 diff 算法）：

```js
// created Items
await Parallel.map(unmatchedChildren, async(newChild) => {
  if (oldFolder.isRoot && oldFolder.location === ItemLocation.LOCAL) {
    // We can't create root folders locally
    return                    // ← 直接跳过，连"创建"这个动作都不产生
  }
  ...
```

**每轮同步的行为**：floccus 都会尝试在电脑端建它 → 命中上面这段被跳过 → **但不产生任何动作**，因此**永远不会反向删除云端上的东西**。Failsafe（20% 阈值）也只统计真正执行的动作，同样不会误报。

**所以准确的说法是**：

- ✅ **不会丢**。那些项目永远存在于云端（Via 端），只是电脑端看不到。
- ⚠️ **但两边口径不一致**：你在 Via 里建的、又在 Via 里删的，那才会真正从云端消失（这时是你主动删的，不是同步删的）。
- 💡 **想让它出现在电脑端**：在 Via 里把它**移进三个固定文件夹**里面（比如拖到「其他收藏夹」下），它就成了正常节点，电脑端立刻能显示。

### 这件事的两种解法（选一个）

**解法 A：把 floccus 的同步根改成三个固定文件夹之一**

选项页 → 账号 → 「本地目标 / 收藏夹」→ 点 📁 → **选「其他收藏夹」**（或「移动收藏夹」，看你的书签主要放哪）→ 保存 → 立即同步。

- ✅ 好处：根级新目录**不在同步范围里**，问题从根上消失
- ⚠️ 代价：**只能同步这一棵子树**，另外两个固定文件夹的内容不同步了

**解法 B：保持同步全部（同步根留在最顶上）**

- ✅ 好处：三个固定文件夹的内容全量同步
- ⚠️ 代价：**只能靠 Via 侧自律** —— 新建时务必选一个具体文件夹，永远不要放在根目录

**两者是二选一**：想全量同步就必须在 Via 侧守规矩；想让代码帮你兜住就得缩窄同步范围。**不能两个都要**——这也是为什么 Via 侧的习惯值得当成硬规则记下来。

---

## 五、手机 Via 那边的注意事项

Via 是双向的：它既下载 `bookmarks.html` 导入，也会把自己改动后的书签**重新上传覆盖同一个文件**。所以：

- ✅ 只要电脑端写的是 Via 认得的格式，两边互相覆盖就是"同一份东西的不同快照"，不会错位、不会丢。
- ⚠️ **别在 Via 的根目录直接新建文件夹或书签**（详见第四章那条）——电脑端的虚拟根放不下第 4 个同级节点，会被静默跳过。这些项**不会丢**（同步不会反向删除云端），但**电脑上永远看不到**，只有 Via 端有。**新建时请点「新建」后选一个具体文件夹**（收藏夹栏 / 其他收藏夹 / 移动收藏夹）。
- ⚠️ 别再挂别的 WebDAV 客户端同时写同一个 `bookmarks.html`，后写的会整体覆盖先写的，且没有合并。
- ⚠️ Via 不帮着合并冲突，谁最后写谁生效。大改之前手动存一份副本。
- ⚠️ 手机端大批量改书签时，别同时跑电脑端同步；同步间隔建议 1 小时以上。
- ℹ️ **电脑上新建的目录/书签，第一次同步后 ID 会重新算一次**（浏览器给的本地 ID 换成云端派生哈希），**不会丢**，但那一次之后建议再手动同步一次让两边对齐；从第 2 轮起完全稳定。Via 侧新建的则全程无此问题。

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
| `src/ui/components/OptionsWebdav.vue` 的文案 | Via 卡片标题 / checkbox 的 label 与 hint / 「已启用」说明段，**全部以中文硬编码在模板里**，不走 `t()`。这样 `_locales` 五个语言包可以**完全保持上游原样、零改动**，语言包彻底退出我们的改动面。**新增（本次）** |
| `src/lib/native/I18n.ts` | 回退链由「当前包 → 英文」改成「当前包 → 同语系兜底包 → 英文」并**逐 key** 查找。现在 `zh_CN` / `zh-Hans` 缺词条会借道 `zh`，只有 `zh_TW` 直接回退英文（不把简体塞给繁体用户）。**这条回退链是我们敢让语言包零改动的前提** —— 它实测能兜住上游 `zh_CN` / `zh-Hans` 缺失的全部 16 条 |
| `check-i18n.js` | 文案覆盖自检：扫源码里所有 `t('Xxx')` 引用，逐语言包比对该 key 是否存在。**懂得了回退链规则**：`zh_CN` / `zh-Hans` 缺但 `zh` 能兜住的词条算「回退兜底」不算缺口；`zh_TW` 不借道简体包所以它的缺口是真缺口。**新增硬约束**：末尾逐个核对 `en/zh/zh_CN/zh-Hans/zh_TW` 与上游是否逐字节一致，任何偏离直接报 FAIL |
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
node pack-for-chrome.js   # 打包入口：先调 pack-for-edge.js 出目录+zip，再打印装法
node check-zip.js         # 交付物 zip 自检，期望 ALL PASS
node audit-extension.js   # 扩展目录合规审计，期望 ALL PASS
```

> 目录和 zip 已现成、只想重新跑一遍自检时：`node pack-for-chrome.js --no-repack`。
> `npx gulp build` 每次都会重新生成 `dist/js/mocha.js`、`dist/js/test.js`、`dist/index.html` 这些测试产物，由 `pack-for-edge.js` 里的 `SKIP_FILES` / `SKIP_DIRS` 拦掉，所以打包前不用手动清 dist。

> **zip 为什么不用 `Compress-Archive`？** PowerShell 的 `Compress-Archive` / .NET 的 `ZipFile` 在 Windows 上会把条目标记成 `icons\logo.png`（反斜杠）而不是 zip 规范要求的 `icons/logo.png`。Windows 资源管理器解压时会把反斜杠还原成目录，所以本地看不出问题；但 **Edge / Chromium 自己的解压器会把 `icons\logo.png` 当成一整个文件名**，结果 `icons` 目录是空的，`manifest.json` 里写的 `icons/logo.png` 找不到，报 `Couldn't load icon icons/logo.png specified in action.` —— 而且用「加载已解压的目录」方式装反而一切正常，很容易被误导成玄学。所以这里直接用 `jszip` 生成 zip（条目名强制正斜杠、显式写目录条目、DEFLATE 压缩，11.5 MB → 5.0 MB）。

### 浏览器适配：Chrome 与 Edge 完全一样

**结论：这份包在 Chrome 和 Edge 上是同一份、装法也一样，没有区别。**

| 浏览器 | 加载解压目录 | 加载 zip | 运行时差异 |
|---|---|---|---|
| **Edge** | `edge://extensions/` → 开发者模式 → 加载已解压的扩展程序 | Edge 侧商店可直接吃这个 zip | 无 |
| **Chrome** | `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序 | 解包后同上 | 无 |

**为什么能这样**：这份 manifest 走的就是官方 `manifest.chrome.json` 那条线（MV3 + `service_worker` + `action` + `host_permissions`），只额外加了 Via 兼容逻辑，**没用任何 Chromium 独有字段，也没用 Firefox 的 `applications.gecko`**。换句话说，它是一个标准 MV3 扩展，两个浏览器都认。

**推荐装法**（两个浏览器都一样，也是唯一推荐的方式）：

1. 打开 `chrome://extensions/`（Edge 是 `edge://extensions/`）
2. 右上角打开「开发者模式」
3. 点「加载已解压的扩展程序」，选 `floccus-via/` 目录
4. 以后改了代码，在扩展卡片上点「刷新」就生效，不用重装

#### 为什么不再产出 .crx（2026-10 起停用）

如果你在旧版本里见过 `floccus-via.crx`，它已经被**删掉且不再生成**了。四个原因：

1. **Chrome 124+ / Edge 已经不接受拖 crx 安装**，必须走开发者模式加载解压目录 —— crx 对普通用户已无意义
2. 自签名 crx 会弹「无法验证此次安装」，对新用户是劝退的第一印象
3. 它依赖仓库根的 `key.pem`：一个「不能提交、不能弄丢」的历史包袱
4. 少一个产物就少一处要维护的东西

**想要 crx 的正确姿势**（一般用不上）：用浏览器自己的功能 —— 开发者模式 → 「打包扩展程序」→ 选 `floccus-via/` 目录，浏览器会自己生成 `.pem` 和 `.crx`。后续必须用**同一个 pem** 打包才能覆盖升级。

> ⚠️ 换了 pem 就等于换了一个新扩展，之前装的那份再也更新不上。停用 crx 反而消除了这个风险。

需要注意的三点：

1. `manifest.json` 里我们故意**没有** `default_locale`（文案是运行时从内联语言包取的，见第七节 `I18n.ts`）。两个浏览器上同样走这条路径，中文正常，不会因为缺 `default_locale` 变英文。
2. **权限里有一个 `tabGroups`**（和官方 Chrome 版一致，`src/lib/LocalTabs.ts` 会 `browser.tabGroups.query({})` 读标签页分组）。不加它代码有 try/catch 兜底不会崩，但分组信息会整片拿不到。
3. 本地解压目录随便装；**想上商店得用官方发布密钥重签**。另外 `unlimitedStorage` 这类权限在商店审核时会被追问用途，本地装不受影响。

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

预期输出 28 项全部 `PASS`，最后打印 `ALL PASS`。

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
VIA_FILE="..." FLOCCUS_FILE="..." node dist/via-check/bundle.js   # 28 项回归
node pack-for-edge.js          # 重新打 ../floccus-via/ 与 dist-out/floccus-via.zip
```

> 回归脚本必须带 `VIA_FILE` / `FLOCCUS_FILE` 两个环境变量（指向真实的 Via 导出和 floccus 导出），否则脚本会因为 `readFileSync(undefined)` 直接崩。

### 两个要记住的坑

**1. `Html.ts` 里的 NUL 分隔符必须写成转义形式。**
`stableId()` 用 NUL 字符拼 key，如果源码里存的是**真 NUL 字节**，git 会把整个 `.ts` 判成二进制文件 —— diff 变成一行 `Bin 3786 -> 13501 bytes`，21 个 hunk 塌成一次整体替换，同步上游时你根本看不到逐行冲突在哪。所以源码里必须写成 `\u0000`（反斜杠 + 6 个字符）而不是按一下 Ctrl+Enter 塞进去的空字节。两者运行效果完全一样，已确认改动前后 28 项回归全过。

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
node pack-for-edge.js           # ⑥ 重新打 ../floccus-via/ 与 dist-out/floccus-via.zip
```

Via 回归要带真实书签文件（脚本会 `readFileSync(undefined)` 崩掉）：

```bash
npx webpack --config webpack.via-check.js
VIA_FILE="E:/Users/xiaom/Downloads/坚果云bookmarks.html" \
FLOCCUS_FILE="E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html" \
node dist/via-check/bundle.js     # 28 项全 PASS
```

### 11.3 P1：必须人工确认的修改点（按危险度排序）

这一节是本节的核心。同步上游后，**只要 `git merge` 后这些文件有变动，就要逐项过一遍**。

| # | 位置 | 上游动了会怎样 | 怎么确认 | 怎么办 |
|---|---|---|---|---|
| **P1-1** | `src/lib/murmurhash3.ts` | **最危险。** `HtmlVia.ts:28` 直接 `import { murmurhash3_32_gc } from '../murmurhash3'`，配上我们自己的双 seed `0x5eeda11` / `0x5eedb22` 生成 Via 稳定 ID。这个文件的算法输出一变，手机 Via 上**已有全部书签的 ID 会被重新算一遍** → 同步时整棵树被判成"全变了"，书签位置会乱、触发全量重建 | `git diff origin/develop -- src/lib/murmurhash3.ts` 看是不是空 | murmur 是标准算法，正常不会动。真动了就保留上游版（我们本来就没改它），但**同步后必须实地完整跑一次双向同步**，确认 Via 端书签没跑位 |
| **P1-2** | `src/lib/serializers/Html.ts` | 我们的 6 个 `VIA-HOOK` 全在这。上游改 `serialize()` / `_serializeFolder()` / `parseDL()` 主体会打架 | `grep -n VIA-HOOK src/lib/serializers/Html.ts` 必须还是 **6 个**，而且顺序别乱 | 除这 6 处，其它冲突**一律接受上游版本**；只把 `if (via)` 分支并排贴回去 |
| **P1-3** | `src/lib/adapters/WebDav.ts` | Via 的两个配置挂在这：`via_compatible` / `via_root_folder`（51、53 行的默认值）+ `getHtmlSerializerOptions()`（96 行）里的短路 `if (!data.via_compatible) return { viaCompatible: false }` | 上游改了 `getDefaultValues` / `getHtmlSerializerOptions` 的签名 | 把我们的两段并回去。**这条短路必须还在**，否则不开 Via 开关也会走兼容路径 |
| **P1-4** | `manifest.json` | `version` 冲突是必然的（上游发版会改，`name` 是我们自己的） | `version` 跟 `name` 同时出现在 diff 里 | 保留上游版本号 + 我们的 `name: floccus-via`；顺手确认 **`tabGroups` 权限还在**（是我们补的，官方 Chrome manifest 有，缺了标签页分组整片拿不到） |
| **P1-5** | `src/ui/components/OptionsWebdav.vue` | Via 卡片（`v-if="via_compatible"` 整块条件显示 + 锁定开关 + 说明），以及密码块/格式块的 `v-if="!via_compatible"`。**根文件夹名输入框已刻意删除，别加回来**（真实文件是三平级，填了反而会多包一层） | `grep -n "VIA-HIDE\|VIA-NOTE" src/ui/components/OptionsWebdav.vue` 应各有 1 处；`grep -c 'v-if="!via_compatible"'` 应为 **2** | 补回这几处。**特别注意别把 `v-if="via_compatible"` 改成无条件**——那会让普通 WebDAV 账号也看到 Via 卡片 |
| **P1-5b** | `src/ui/views/NewAccount.vue` | **第 3 步（服务器设置，WebDAV URL 之前）**的 Via 勾选框 + **同屏密码短语**的 `v-if="!via_compatible"` + `onViaCompatibleChange()` 三联动预填（路径→`Via/bookmarks.html`、格式→html）+ `onCreate` 里那行 `via_compatible: true` 白名单 | `grep -c "VIA-COMPAT" src/ui/views/NewAccount.vue` 应为 5（勾选框 1 + 第4步说明 1 + data 1 + 方法 1 + onCreate 1）；密码短语的 `v-if="!via_compatible"` 应为 1 处 | ⚠️ **最易踩空的一处**：上游若重构 `onCreate` 的传参区（它本来就是白名单式 `...(条件 && {字段})`），我们那行会被冲掉 → **勾选只停在界面上、存不进账号**，且**不报任何错**，表现是设置页两块没隐藏、Via 不生效。改完务必实地建一个新号验证 |
| **P1-5c** | `src/ui/components/OptionsWebdav.vue` + `src/ui/views/NewAccount.vue` 模板里的中文文案 | Via 全部文案**就地硬编码**（不走 `t()`） | `grep -rn "Via 浏览器兼容" src/ui/` 应为 2 处；`grep -rn "t('Label.*Via\|t('Description.*Via" src/` 应**无输出** | ⚠️ **不要再往 `_locales` 加 Via 词条** —— 五个语言包保持上游原样、零改动是本分支的硬约束，`check-i18n.js` 末尾会逐包核对，与上游不一致直接 FAIL。要改文案就改这两个模板里的中文 |
| **P1-6** | `src/lib/native/I18n.ts` | 我们改了回退链：逐 key 回退 + 同语系借道（`zh_CN`/`zh-Hans` 缺词借 `zh`） | 上游动 I18n 会冲突 | 保留 `getMessageChain` 与 `zh-Hans` 借道，否则 Via 那几个新文案会露英文 |
| **P1-7** | `src/lib/adapters/Caching.ts` | `WebDav.ts:99` 从 `this.bookmarksCache.viaRootName` 读根文件夹名。上游重构缓存结构 → 根名读不到 | 表现是 Via 端"单一根包装文件夹"识别失效（手机端顶层对不上电脑端） | 把 `viaRootName` 挂回新的缓存对象上 |
| **P1-8** | `src/lib/Tree.ts` | 我们只加了可选字段 `viaRootName?: string`（410 行） | — | 可选字段，上游怎么改都接得上，基本不冲突 |
| **P1-9** | `_locales/*` 五个中文包 | 上游在 Transifex 加新文案 → 中文缺词 | `node check-i18n.js` 报缺口 | 按清单补；`zh_CN`/`zh_Hans` 有借道兜底，长期还是补上 |
| **P1-10** | `html/background.html` | 我们删了 `../../lib/chrome-promise.js` 这个死引用 | 上游重加回引用会怎样 | 只要没人引用它就不影响打包（曾经因为它导致安装失败） |

### 11.4 P2：顺手看一眼（不动也不会立刻出事）

#### ⭐ 上游哪些「不冲突」但会悄悄影响我们的改动

这一类最阴：**git 不会报任何冲突，测试也全绿，但功能悄悄坏了。** 所以每次同步后，除了走 P1 表格，还要专门想一遍这几条：

| 上游改了什么 | 为什么不冲突 | 会怎么坏 | 怎么发现 |
|---|---|---|---|
| `onCreate` 的传参结构 | 我们只是往里加了一行 | **Via 勾选存不进账号**，设置页两块不隐藏、Via 完全不生效，且无任何报错 | 建一个新号勾 Via，看存进去的 `via_compatible` 是不是 true（见 P1-5b） |
| `bookmark_file` / `bookmark_file_type` 的默认值 | 改的是别处 | 向导预填的 `Via/bookmarks.html` 可能被上游默认覆盖 | 新建 Via 账号，看路径框是不是 `Via/bookmarks.html` |
| `ItemLocation` / `Bookmark` 构造签名 | 我们的测试是 JS，不参与 TS 类型检查 | `via-check.js` 里造节点的代码会失败 | 28 项回归跑不起来（这类反而会立刻暴露） |
| 锁文件 / `.temp` 机制 | 完全不碰 | Via 端可能读到写了一半的文件 | 真机同步时 Via 侧提示文件损坏 |
| `Crypto.encryptAES` 签名或 passphrase 判定条件 | 我们的 Via 路径不走加密 | 官方路径可能突然加了对文件格式的校验 | `check-official-compat` 的 sha 变化 |

**一句话原则**：**冲突只是提醒，不是全部风险。** 21 个 hunk 全自动合并成功 ≠ 功能正常 —— 上面这张表里的东西，git 一个字都不会提示你。

#### 其它 P2 项

- **`android/` 和 `ios/` 下 8 个文件在 `git status` 里永远是 `M`** —— 这是 Windows 行尾噪声（`core.autocrlf=true` 且仓库没有 `.gitattributes`），实测 8 个文件全部是纯 CRLF/LF 差异、**零语义改动**。所以提交时**必须精确 `git add` 指定文件，永远不要 `git add -A`**，否则就是把 8 个全文件行尾改动灌进历史。
- **`floccus-via.zip`** 是本地产物，已写进 `.git/info/exclude`（本机专属、不进仓库）。换机器要重新生成，别提交。
- **`.crx` / `.pem`**：2026-10 起已停用（原因见第八章），仓库里不再有这两个文件。`.gitignore` 里的 `key.pem`（上游原有）和 `*.crx`（本分支追加）都保留着，万一你自己用浏览器「打包扩展程序」生成了，也不会被误提交。
- **`dist/` 里的 `via-check` / `official-check` / `via-check-tsc` 三个目录**是校验产物，被 `pack-for-edge.js` 的 `SKIP_DIRS` 挡在包外，本地占 6 MB 属正常。
- 我们新增的全部文件（`HtmlVia.ts`、`check-*.js`、`pack-*.js`、`src/entries/via-check.js`、`webpack.via-check.js`、**本文件**）**上游都不存在 → 永远不冲突**，唯一要盯的是别被误删。

### 11.5 一页速查卡

```bash
# 同步前：体检，只读
node sync-upstream.js

# 同步中：git merge origin develop
# 同步后：撞到 11.3 表格里任一文件 → 逐项过

# 六步自检（顺序别乱）
npx gulp build && node check-official-compat.js && node check-i18n.js \
  && node check-zip.js && node audit-extension.js && node pack-for-chrome.js

# Via 回归（必须带环境变量）
npx webpack --config webpack.via-check.js
VIA_FILE="…/坚果云bookmarks.html" FLOCCUS_FILE="…/floccus-…export.html" \
  node dist/via-check/bundle.js     # 28 项全 PASS

# 冲突定位（全部 8 个锚点）
grep -c VIA-HOOK      src/lib/serializers/Html.ts            # 必须 6
grep -n VIA-COMPAT    src/ui/views/NewAccount.vue            # 必须 2
grep -n "VIA-HIDE\|VIA-NOTE" src/ui/components/OptionsWebdav.vue   # 各 1
grep -n via_compatible src/lib/adapters/WebDav.ts             # 兜底必须还在
grep -n tabGroups     manifest.json                           # 必须在
git diff origin/develop -- src/lib/murmurhash3.ts             # 必须为空

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

### 11.11 Via 模式下为什么看不到「密码短语」和「文件格式」

**这是有意藏起来的，不是界面坏了。**

Via 只能读**未加密的 Netscape 格式 HTML**。如果给 Via 账号加密，`WebDav.ts` 会把整个文件换成 `{ciphertext, salt}` 密文；如果选 XBEL，Via 根本读不了。所以这两项和 Via 是互斥的，勾上 Via 就自动藏掉：

| 界面位置 | 行为 |
| --- | --- |
| **新建账号向导 · 第 3 步**（服务器设置） | 勾「Via 浏览器兼容」→ **同屏的「密码短语」立刻消失**；第 4 步的路径预填 `Via/bookmarks.html`、格式锁定 HTML、格式选择框消失 |
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

Via 文案现在**不走语言包**，直接以中文写死在两个组件的模板里：

| 位置 | 有哪几句 |
| --- | --- |
| `src/ui/components/OptionsWebdav.vue` Via 卡片 | 卡片标题「Via 浏览器兼容」、checkbox 的 `label` / `hint`、以及说明段（讲清为什么选项不见了、想换回官方格式只能删号重建） |
| `src/ui/views/NewAccount.vue` 向导第 3 步 | 勾选框的 `label` / `hint`（讲清勾上后路径自动填、格式锁 HTML、密码短语会隐藏、且不可取消） |

> 「Via 浏览器兼容」这同一句话在模板里出现两处（两个文件各一次），改措辞时记得同步。设置页的卡片标题与 checkbox label 相邻重复，但属于官方 Vuetify 卡片结构，保留不动。

**为什么这么做**：`_locales` 是上游文件，往里加词条等于在语言包里制造冲突面（上游改词条就冲突、上游加词条就漏译），而且历史上往语言包写词条出过 P0 事故（条目结构写错导致选项页白屏）。硬编码之后五个语言包可以完全保持上游原样，语言包彻底退出改动面。

> ⚠️ **代价**：英文/繁体用户看到的 Via 卡片也是中文。Via 兼容本身服务中文用户群体，可接受。若将来真要做多语言，就在两个模板里改成 `locale === 'zh' ? '中文' : i18n.t('Key')` 之类的形式，**仍然不需要碰 `_locales`**。

### 11.12 产物放在哪：为什么扩展目录不能挪

打包产物分两处，**不是随手摆的**：

| 产物 | 位置 | 能挪吗 |
| --- | --- | --- |
| **扩展目录** `floccus-via/` | `floccus-src` 的**上一级** | ❌ **不能挪，见下** |
| **zip** `floccus-via.zip` | `floccus-src/dist-out/` | ✅ 随便挪（只是备份/分发用） |

`dist-out/` 已写进 `.gitignore` 与 `.git/info/exclude`，产物永不入库。

### ⚠️ 为什么扩展目录必须留在固定路径

**Edge / Chrome 的扩展 ID 由「该目录的绝对路径」哈希决定。**

```
扩展目录路径变了 → ID 变了 → 浏览器当成【另一个新扩展】
                → storage 里的账号配置、Via 勾选状态、同步设置全都读不到
```

实测踩过一次：把产物挪到 `floccus-src/dist-out/floccus-via` 后，虽然功能一切正常，但用户 Edge 里原本那个 floccus-via 变成了「新扩展」。**如果那时用户已经点过刷新，账号数据就丢了。**

所以：

- ✅ 改代码后照旧覆盖回 `../floccus-via/`，在扩展卡片点「刷新」——路径不变、ID 不变、数据都在
- ❌ 别为了「看起来整齐」把扩展目录挪进 `dist-out/` 或别处
- `pack-for-edge.js` 里加了硬检查：`OUT` 不是约定路径就直接 `exit 1`，防止以后（尤其是换机器、clone 到别处时）误改

**顺带**：如果你换机器、目录路径整体变了（比如从 `D:\xiaom\...` 挪到别处），那本来就得在扩展页重新「加载已解压的扩展程序」一次——这时 ID 会变、storage 是新的，属于预期行为，配置重新建一遍即可。真正要防的是**同一台机器上路径被无意改动**。

### 11.13 真实案例：同步上游后 `gulp build` 直接挂（原生依赖改名）

**时间线**：2026-10-08 同步上游 `develop`（`944fc3e` → `91a1d2ca`，4 个提交，看着全是 iOS / CI，跟 PC 扩展八竿子打不着）。

| 提交 | 内容 |
| --- | --- |
| `178af076` | chore: update mindlib-capacitor/send-intent |
| `480a3d4b` | fix(ci): Fix CodeQL action |
| `16dcc3f1` | [native] fix(send-intent): Fix send intent on iOS |
| `91a1d2ca` | fix: update ios files |

**唯一会伤到构建的一处**（`package.json`）：

```
- "send-intent": "7.x"
+ "@mindlib-capacitor/send-intent": "8.x"
```

**为什么改个「iOS 用的包」能让 PC 扩展构建失败？** 因为 webpack 会顺着静态 import 一路解析，PC 扩展的入口链路里就夹着它们：

```
entries/options.js → ui (Update.vue 静态 import) → ui/NativeRouter.js
   → 静态 import views/native/Home.vue
   → import { SendIntent } from '@mindlib-capacitor/send-intent'   ← 缺包即 Module not found
```

`src/ui/NativeRouter.js` 对 native 视图是**静态 import**（不是懒加载），所以这两个原生容器页面被 PC 构建一并打包。node_modules 里只有旧包 `send-intent` 时，`gulp build` 直接抛 `Module not found`，**整包出不来**。

**处理（三步，缺一不可）**：

```bash
git merge --ff-only fork/my-viasync      # 或直接 git merge origin/develop
npm install                              # ① 按上游的 package-lock.json 装新依赖
npx gulp build                           # ② 重新构建
node check-official-compat.js            # ③ 官方 sha 必须仍是 33ea98f5…/ 39147 字节
```

> `npm install` 会自动把旧包 `send-intent` 摘掉、装上 `@mindlib-capacitor/send-intent`（实测：added 1, removed 3，13 秒）。**别手动 cp 旧目录凑数**，version 对不上会以别的方式炸。

**同步结果（`96a9c8d3`）**：

- Via 核心文件**一个都没被动**：`Html.ts` 的 6 个 VIA-HOOK 原样、`HtmlVia.ts` 在、`OptionsWebdav.vue` Via 卡片在、`NewAccount.vue` 勾选框在
- `src/lib/murmurhash3.ts` / `src/lib/Caching.ts` / `_locales` 五包与上游**零 diff**（最高危点 + 语言包都没碰）
- `check-official-compat` ALL PASS（sha `33ea98f5` / 39147 字节）—— 不开 Via 开关时输出与官方逐字节一致
- Via 回归 **28 项 ALL PASS**（真实文件 `坚果云bookmarks.html` + floccus 导出）
- `audit-extension` 33 PASS / 0 FAIL；`check-zip` 182 条目 CRC 通过

**结论与经验**：

> **上游只要动了 `package.json`，同步后就必须 `npm install`，哪怕那个依赖看起来只服务于 iOS / Android 原生容器。**
> 判断依据不是「这个包 PC 用不用」，而是「webpack 的静态 import 链路会不会碰到它」——NativeRouter 是个共用路由，native 视图躲不掉。

这条已经写成 `sync-upstream.js` 的 P1 常驻检查项（`git diff 944fc3ea origin/develop -- package.json` + `node_modules/@mindlib-capacitor/send-intent 存在`），下次再遇到会直接报出来。

### 11.14 跑 Via 回归必须用真实文件，别用 fixtures/ 下的样本

`src/entries/via-check.js` 里那几条「顶层 13 个并列条目」「排头是『一加5』」是对**真实 Via 导出**的断言。仓库里的 `fixtures/via-real.html` 是 Chrome 形态（顶层是 `Bookmarks Bar`），拿它跑会挂 6 条：

```
FAIL  顶层 13 个并列条目（实际 3）
FAIL  排头是「一加5」（实际 Bookmarks Bar）
FAIL  顶层含 手机应用 / tvbox / 免root玩机
FAIL  同级重名文件夹拿到不同稳定 ID
FAIL  根级 ADD_DATE 原样回写（1754285806）…
FAIL  再解析后重名文件夹 ID 仍不冲突
```

**这是 fixtures 样本与目标断言不匹配，不是代码回归**（换成真实文件后 28 项全 PASS）。跑回归请这样：

```bash
npx webpack --config webpack.via-check.js
VIA_FILE="E:/Users/xiaom/Downloads/坚果云bookmarks.html" \
FLOCCUS_FILE="E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html" \
  node dist/via-check/bundle.js
```
