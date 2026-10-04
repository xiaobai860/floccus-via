import IntlMessageFormat from 'intl-messageformat'
import DEFAULT_MESSAGES from '../../../_locales/en/messages.json'
// 简体中文兜底包。上游的 zh_CN / zh-Hans 常常落后于 zh（缺若干新词条），
// 若缺 key 就直接回退英文，中文用户会在设置页看到一整块英文。
// 这里让 zh_CN / zh-Hans 先回退到 zh，再回退 en。
import SIMPLIFIED_CHINESE_MESSAGES from '../../../_locales/zh/messages.json'

// hehe, ignore all the things...
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const context = require.context(
  '../../../_locales',
  true,
  /^.*?\.json$/,
  'lazy'
)

interface TranslationEntry {
  message: string;
}
interface Messages {
  [key: string]: TranslationEntry;
}

export default class I18n {
  private locales: string[];
  private locale = 'en'
  private messages: Messages | undefined;
  constructor(locale: string) {
    this.locales = [locale]
    this.messages = DEFAULT_MESSAGES
  }

  setLocales(locales:string[]):void {
    this.locales = locales
  }

  async load():Promise<void> {
    for (const locale of this.locales) {
      try {
        const fileName = './' + locale.replace('-', '_') + '/messages.json'
        const imported = await context(fileName)
        console.log(imported)
        this.messages = imported
        this.locale = locale
        break
      } catch (error) {
        console.warn(error)
      }
      try {
        const fileName = './' + locale.split('-')[0] + '/messages.json'
        const imported = await context(fileName)
        console.log(imported)
        this.messages = imported
        this.locale = locale.split('-')[0]
        break
      } catch (error) {
        console.warn(error)
      }
    }
  }

  /**
   * Get a formatted message with the given name
   */
  public getMessage(messageName: string, content?: any, formats?: any): string {
    const string = this.doGetMessage(messageName)
    if (string) {
      const message = new IntlMessageFormat(string.message, this.locale, formats).format(content)
      if (!message) {
        return messageName
      }
      if (Array.isArray(message)) {
        return message.join('')
      }
      return message
    }
    return messageName
  }

  /**
   * Get message with given name
   */
  /**
   * 回退链：当前语言包 → 同语系兜底包 → 英文兜底。
   * 逐 key 向下找，而不是整包切换，这样单个词条缺失只影响那一条。
   */
  private getMessageChain(): Messages[] {
    const chain: Messages[] = []
    if (this.messages) chain.push(this.messages)
    // zh-CN / zh-Hans 先借道 zh（简体）；zh-TW 不借用，避免繁体用户看到简体
    if (this.locale === 'zh_CN' || this.locale === 'zh-Hans') {
      chain.push(SIMPLIFIED_CHINESE_MESSAGES as Messages)
    }
    chain.push(DEFAULT_MESSAGES)
    return chain
  }

  private doGetMessage(messageName: string): TranslationEntry | null {
    for (const messages of this.getMessageChain()) {
      if (messages && Object.hasOwnProperty.call(messages, messageName)) {
        return messages[messageName]
      }
    }
    console.warn(
      `No message found with name ${messageName} for locale ${this.locale}. Tried the fallback chain and gave up.`
    )
    return null
  }
}

export const i18n = new I18n('en')
