<template>
  <v-container>
    <div>
      <v-text-field
        append-icon="mdi-label"
        class="mt-2 mb-4"
        :value="label"
        :label="t('LabelAccountlabel')"
        :hint="t('DescriptionAccountlabel')"
        :persistent-hint="true"
        @input="$emit('update:label', $event)" />
    </div>
    <v-card class="mb-4">
      <v-card-text
        id="server"
        class="text-h5"
        role="heading"
        aria-level="2">
        <v-icon aria-hidden="true">
          mdi-account-box
        </v-icon>
        {{ t('LabelOptionsServerDetails') }}
      </v-card-text>
      <v-card-text>
        <v-text-field
          :value="url"
          :rules="[validateUrl]"
          :label="t('LabelWebdavurl')"
          @input="$emit('update:url', $event)" />
        <v-text-field
          :value="username"
          :label="t('LabelUsername')"
          @input="$emit('update:username', $event)" />
        <v-text-field
          :label="t('LabelPassword')"
          :type="showPassword ? 'text' : 'password'"
          @input="$emit('update:password', $event)">
          <template #append>
            <v-icon
              role="button"
              tabindex="0"
              :aria-label="
                showPassword ? t('LabelHidepassword') : t('LabelShowpassword')
              "
              @click="showPassword = !showPassword"
              @keydown.enter="showPassword = !showPassword"
              @keydown.space.prevent="showPassword = !showPassword">
              {{ showPassword ? 'mdi-eye' : 'mdi-eye-off' }}
            </v-icon>
          </template>
        </v-text-field>
        <v-text-field
          append-icon="mdi-file-document"
          :value="bookmark_file"
          :rules="[validateBookmarksFile]"
          :label="t('LabelBookmarksfile')"
          :hint="t('DescriptionBookmarksfile')"
          :persistent-hint="true"
          @input="$emit('update:bookmark_file', $event)" />
        <!--
          VIA-HIDE-1/2：Via 兼容账号把「密码短语」和「文件格式」整块藏掉。

          为什么必须藏：这两项和 Via 是互斥的，而且藏起来比置灰更省——
          置灰要改 OptionPassphrase.vue / OptionFileType.vue 两个上游组件本体
          （各加一个 disabled prop），等于为我们的功能去动无辜文件；隐藏只需
          在调用处加 v-if，冲突面留在这张卡里我们自己那一片。

          藏着的同时数据层也要保证（见 WebDav.ts 的 VIA-GUARD），否则导入旧配置
          之类绕过界面的路径仍可能触发加密。隐藏是给人看的，兜底是给数据看的。
        -->
        <OptionPassphrase
          v-if="!via_compatible"
          :value="passphrase"
          @input="$emit('update:passphrase', $event)" />
        <OptionFileType
          v-if="!via_compatible"
          :value="bookmark_file_type"
          @input="$emit('update:bookmark_file_type', $event)" />
      </v-card-text>
    </v-card>

    <!--
      Via 浏览器书签双向同步专用。Via 导出的 bookmarks.html 不是 floccus 自己那套
      格式：整棵树被包在一个根文件夹里（例如「一加5」），只有 ADD_DATE，没有 floccus
      的 ID/TAGS。打开这个开关后，读写都按 Via 原生 Netscape 格式走，详见
      src/lib/serializers/Html.ts 顶部注释。

      VIA-HIDE-2/2：整张卡片只在「已经是 Via 账号」时出现，普通 WebDAV 账号看不到它。
      开启 Via 的唯一入口是新建账号向导（那里会一次性预填 Via/bookmarks.html + HTML 格式）。
      这样做的原因：这里**不能做成可切换的开关**。开启需要三件事同时改（路径、格式、加密），
      而取消则要决定"文件格式变回什么、云端文件怎么处理"——一旦允许中途切换，
      就得为「格式与实际内容对不上」写一堆补救逻辑，同步失败时用户看到的还是一堆英文报错。
      整块隐藏 + 只在向导开启，是唯一没有中间态的做法。已开启的账号开关保持可见但锁定，
      旁边写清想换回官方格式只能删号重建。
    -->
    <v-card
      v-if="via_compatible"
      class="mb-4">
      <v-card-title
        id="via"
        class="text-h5"
        role="heading"
        aria-level="2">
        <v-icon aria-hidden="true">
          mdi-cellphone-link
        </v-icon>
        Via 浏览器兼容
      </v-card-title>
      <v-card-text>
        <!--
          这里只会出现在已经是 Via 账号的设置页上（外层 v-if 挡住了普通账号），
          所以开关必定是勾选状态，直接 disabled 锁住即可。
          label/hint 直接写中文而不走 t()：_locales 五个语言包保持上游原样、零改动，
          Via 文案就地硬编码（本分支只服务中文用户，这是冲突面最小的做法）。
          改文案时两处要同步：这里的 checkbox label/hint + 本卡片标题，以及
          src/ui/views/NewAccount.vue 里向导第3 步那个勾选框。
        -->
        <v-checkbox
          :input-value="true"
          :true-value="true"
          :false-value="false"
          disabled
          label="Via 浏览器兼容"
          hint="Via 只能读取未加密的 Netscape 格式书签文件，因此本配置不能设置密码短语，也不能使用 XBEL 格式。"
          persistent-hint />
        <!--
          VIA-NOTE：讲清"密码和格式为什么不见了"以及怎么换回官方模式。
          不加这句的话用户看到选项凭空消失会当成界面坏了。
        -->
        <p
          class="caption mt-2 mb-0"
          role="note">
          Via 兼容已启用：密码短语与文件格式两项已锁定不可修改（这是 Via 能读懂该文件的必要条件）。想改回官方格式，请删除本账号后重新建立一个不勾选 Via 的账号。
        </p>
        <!--
          这里原来有一个「Via 根文件夹名」输入框（via_root_folder），已删除。
          实测用户的真实文件（fixtures/via-real、via-newroot、floccus-real）顶层都是
          Bookmarks Bar / Other Bookmarks / 移动收藏夹 这种**三平级**结构，
          findSingleRootFolder 全部不触发 → 根文件夹名留空就是正确行为。
          而它反而是有害的：填了会让 serialize 在文件外面强行再包一层（rootFolderName
          优先级最高），Via 那边会看到结构变了。
          ⚠️ 注意：**只删了这个输入框，不要动 HtmlVia.ts 里的自动机制**
          （findSingleRootFolder + lastRootFolderName + ROOT_DATE_KEY）。
          万一 Via 哪天把文件变成「单一根包装」形态（例如用户只留一个顶层目录），
          那套机制会自动认出根名字并原样包回去；删掉它就会静默丢掉那层包装。
          WebDav.getDefaultValues 里的 via_root_folder 字段也保留（getData() 回落链要用）。
        -->
      </v-card-text>
    </v-card>

    <v-card
      v-if="isBrowser"
      class="mb-4">
      <v-card-title
        id="folder"
        class="text-h5"
        role="heading"
        aria-level="2">
        <v-icon aria-hidden="true">
          mdi-folder-outline
        </v-icon>
        {{ t('LabelOptionsFolderMapping') }}
      </v-card-title>
      <v-card-text>
        <OptionSyncFolder
          :value="localRoot"
          @input="$emit('update:localRoot', $event)" />
      </v-card-text>
    </v-card>

    <v-card
      v-if="!isBrowser"
      class="mb-4">
      <v-card-title
        id="mobile"
        class="text-h5"
        role="heading"
        aria-level="2">
        <v-icon aria-hidden="true">
          mdi-cellphone-settings
        </v-icon>
        {{ t('LabelMobilesettings') }}
      </v-card-title>
      <v-card-text>
        <OptionAllowNetwork
          :value="allowNetwork"
          @input="$emit('update:allowNetwork', $event)" />
        <OptionExportBookmarks />
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title
        id="sync"
        class="text-h5"
        role="heading"
        aria-level="2">
        <v-icon aria-hidden="true">
          mdi-sync-circle
        </v-icon>
        {{ t('LabelOptionsSyncBehavior') }}
      </v-card-title>
      <v-card-text>
        <OptionAutoSync
          :value="enabled"
          @input="$emit('update:enabled', $event)" />
        <OptionSyncOnStartup
          :value="syncOnStartupEnabled"
          @input="$emit('update:syncOnStartupEnabled', $event)" />
        <template v-if="isBrowser">
          <OptionSyncIntervalEnabled
            :value="syncIntervalEnabled"
            @input="$emit('update:syncIntervalEnabled', $event)" />
          <OptionSyncInterval
            v-if="syncIntervalEnabled"
            :value="syncInterval"
            @input="$emit('update:syncInterval', $event)" />
        </template>
        <OptionSyncStrategy
          :value="strategy"
          @input="$emit('update:strategy', $event)" />
        <OptionNestedSync
          v-if="isBrowser"
          :value="nestedSync"
          @input="$emit('update:nestedSync', $event)" />
      </v-card-text>
    </v-card>

    <v-card class="mb-4">
      <v-card-title
        id="danger"
        class="text-h5"
        role="heading"
        aria-level="2">
        <v-icon aria-hidden="true">
          mdi-alert-circle
        </v-icon>
        {{ t('LabelOptionsDangerous') }}
      </v-card-title>
      <v-card-text>
        <OptionDownloadLogs />
        <OptionClientCert
          v-if="isBrowser"
          :value="includeCredentials"
          @input="$emit('update:includeCredentials', $event)" />
        <OptionAllowRedirects
          :value="allowRedirects"
          @input="$emit('update:allowRedirects', $event)" />
        <OptionResetCache @click="$emit('reset')" />
        <OptionFailsafe
          :value="failsafe"
          @input="$emit('update:failsafe', $event)" />
        <OptionDeleteAccount @click="$emit('delete')" />
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import OptionSyncInterval from './OptionSyncInterval'
import OptionResetCache from './OptionResetCache'
import OptionSyncStrategy from './OptionSyncStrategy'
import OptionDeleteAccount from './OptionDeleteAccount'
import OptionSyncFolder from './OptionSyncFolder'
import OptionNestedSync from './OptionNestedSync'
import OptionFailsafe from './OptionFailsafe'
import OptionClientCert from './OptionClientCert'
import OptionAllowRedirects from './OptionAllowRedirects'
import OptionDownloadLogs from './OptionDownloadLogs'
import OptionAllowNetwork from './native/OptionAllowNetwork'
import OptionFileType from './OptionFileType'
import OptionExportBookmarks from './OptionExportBookmarks.vue'
import OptionPassphrase from './OptionPassphrase.vue'
import OptionAutoSync from './OptionAutoSync.vue'
import OptionSyncIntervalEnabled from './OptionSyncIntervalEnabled.vue'
import OptionSyncOnStartup from './OptionSyncOnStartup.vue'

export default {
  name: 'OptionsWebdav',
  components: {
    OptionSyncOnStartup,
    OptionSyncIntervalEnabled,
    OptionAutoSync,
    OptionExportBookmarks,
    OptionAllowNetwork,
    OptionDownloadLogs,
    OptionAllowRedirects,
    OptionClientCert,
    OptionFailsafe,
    OptionSyncFolder,
    OptionDeleteAccount,
    OptionSyncStrategy,
    OptionResetCache,
    OptionSyncInterval,
    OptionNestedSync,
    OptionFileType,
    OptionPassphrase,
  },
  props: [
    'url',
    'username',
    'password',
    'passphrase',
    'includeCredentials',
    'serverRoot',
    'localRoot',
    'allowNetwork',
    'syncInterval',
    'strategy',
    'bookmark_file',
    'nestedSync',
    'failsafe',
    'allowRedirects',
    'bookmark_file_type',
    'via_compatible',
    // 'via_root_folder' 已从 props 移除：界面上不再有该输入框（理由见模板里的说明）。
    // WebDav.getDefaultValues() 里的该字段仍然保留，getData() 回落链与自动机制都还用到。
    'enabled',
    'label',
    'syncIntervalEnabled',
    'syncOnStartupEnabled',
  ],
  data() {
    return {
      panels: [0, 1],
      showPassword: false,
      showPassphrase: false,
    }
  },
  methods: {
    validateUrl(str) {
      try {
        const u = new URL(str)
        return Boolean(u) && u.protocol.startsWith('http')
      } catch (e) {
        return false
      }
    },
    validateBookmarksFile(path) {
      return path[0] !== '/' && path[path.length - 1] !== '/'
    },
  },
}
</script>

<style scoped></style>
