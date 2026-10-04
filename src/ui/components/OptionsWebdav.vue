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

      VIA-HIDE-2/2：勾上之后开关就锁定不可取消。这里不是"忘了做双向切换"，
      而是刻意的 —— Via 与加密、XBEL 格式互斥（见上面藏掉的两块），中途放开
      会让文件格式和实际内容对不上，同步直接报错。解锁办法写在下面的说明里：
      删掉这个账号重建一个不勾 Via 的。想换回官方格式也只有这一条路。
    -->
    <v-card class="mb-4">
      <v-card-title
        id="via"
        class="text-h5"
        role="heading"
        aria-level="2">
        <v-icon aria-hidden="true">
          mdi-cellphone-link
        </v-icon>
        {{ t('LabelOptionsViaCompat') }}
      </v-card-title>
      <v-card-text>
        <v-checkbox
          :input-value="via_compatible"
          :true-value="true"
          :false-value="false"
          :disabled="via_compatible"
          :label="t('LabelViaCompatible')"
          :hint="t('DescriptionViaCompatible')"
          :persistent-hint="true"
          @change="$emit('update:via_compatible', $event)" />
        <!--
          VIA-NOTE：已启用时补一条说明，讲清"密码和格式为什么不见了"以及怎么换回官方模式。
          不加这句的话用户看到选项凭空消失会当成界面坏了。
        -->
        <div
          v-if="via_compatible"
          class="caption mt-2"
          role="note">
          {{ t('DescriptionViaLocked') }}
        </div>
        <v-text-field
          v-if="via_compatible"
          class="mt-2"
          :value="via_root_folder"
          :label="t('LabelViaRootFolder')"
          :hint="t('DescriptionViaRootFolder')"
          :persistent-hint="true"
          @input="$emit('update:via_root_folder', $event)" />
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
    'via_root_folder',
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
