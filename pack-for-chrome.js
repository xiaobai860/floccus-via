#!/usr/bin/env node
/* eslint-disable no-console */
// 打包入口：产出扩展目录 + zip（Chrome / Edge 通用）。
//
// 用法：
//   node pack-for-chrome.js              打目录 + zip
//   node pack-for-chrome.js --no-repack  目录和 zip 已现成，只做自检
//
// 为什么不再产出 .crx（2026-10 起停用）
// ─────────────────────────────────────────────────────────────────────────────
//   1) Chrome 124+ / Edge 已经不接受「拖 crx 安装」，必须走开发者模式加载解压目录，
//      crx 这个格式对普通用户已经没有实际意义。
//   2) 自签名 crx 会弹「无法验证此次安装」，对新用户是劝退的第一印象。
//   3) 它依赖仓库根的 key.pem —— 一个必须「不能提交、不能弄丢」的历史包袱，
//      而装了同一个 zip 的用户拿到的扩展 id 是由「公钥」决定的，删掉 crx 并不影响
//      已安装用户的升级（id 取决于 manifest 里的 key，仓库里本来就没写）。
//   4) 少一个产物就少一处要维护的东西，脚本职责更单一。
//
// 想要 crx 的正确姿势（一般用不上）：用 Chrome 自己的「打包扩展程序」功能
//   chrome://extensions/ → 开发者模式 → 打包扩展程序 → 选 floccus-via 目录
//   → 会自己生成 .pem 与 .crx 并记住 key，后续用同一个 pem 打包才能覆盖升级。
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = __dirname
const OUT_NAME = 'floccus-via'
const OUT = path.join(ROOT, '..', OUT_NAME)
const ZIP = path.join(ROOT, OUT_NAME + '.zip')

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB'

const main = () => {
  if (!process.argv.includes('--no-repack')) {
    console.log('→ 先跑 pack-for-edge.js 组装目录与 zip…')
    execFileSync(process.execPath, [path.join(ROOT, 'pack-for-edge.js')], { stdio: 'inherit' })
  }

  if (!fs.existsSync(ZIP)) {
    console.error('找不到 ' + ZIP + '，先跑 node pack-for-edge.js')
    process.exit(1)
  }
  if (!fs.existsSync(OUT)) {
    console.error('找不到扩展目录 ' + OUT)
    process.exit(1)
  }
  if (!fs.existsSync(path.join(OUT, 'manifest.json'))) {
    console.error(OUT + ' 里没有 manifest.json，不是合法的扩展目录')
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'))
  const zipSize = fs.statSync(ZIP).size
  const entryCount = fs
    .readdirSync(OUT)
    .reduce((n, f) => n + (fs.statSync(path.join(OUT, f)).isDirectory() ? 1 : 1), 0)

  console.log('')
  console.log('产物  ->', ZIP, mb(zipSize))
  console.log('目录  ->', OUT, '（' + entryCount + ' 个顶层条目）')
  console.log('名称  ->', manifest.name, manifest.version)
  console.log('')
  console.log('装法（Chrome 与 Edge 完全一样，没有区别）：')
  console.log('  1) 打开 chrome://extensions/ （Edge 是 edge://extensions/）')
  console.log('  2) 右上角打开「开发者模式」')
  console.log('  3) 点「加载已解压的扩展程序」，选目录：')
  console.log('     ' + OUT)
  console.log('  4) 以后改了代码，在扩展卡片上点「刷新」即可，不用重装。')
  console.log('')
  console.log('想装 zip：解包后同样走上面第 3 步。Edge 侧商店也可以直接吃这个 zip。')
}

main()
