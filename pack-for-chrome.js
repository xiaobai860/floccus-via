#!/usr/bin/env node
/* eslint-disable no-console */
// 给 Chrome（以及任何 Chromium 内核浏览器）打包：在 pack-for-edge.js 的产出一倍之外，
// 再多打一个 .crx —— 这样可以「双击 crx 直接装」，不用去 chrome://extensions/ 里拨开发者模式。
//
// 用法：
//   node pack-for-chrome.js              先调 pack-for-edge.js 打目录+zip，再打 crx
//   node pack-for-chrome.js --no-repack  目录和 zip 已现成（比如刚跑过 pack-for-edge.js），只补 crx
//
// 关于 crx：
//   upstream 的 gulpfile.js 里本来就有 crx() 任务（用 crx3 1.1.3），只是挂在 `gulp release`
//   上，日常 `gulp build` 不会跑。这里把它单独拆出来用。
//   crx3 会自己生成 RSA 私钥并存到 key.pem（第一次跑才有，之后复用），
//   所以同一个 crx 反复打 app id 不变；换机器会把 ~/. 下的 key 跟着一起带走才能自动更新。
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = __dirname
const OUT_NAME = 'floccus-via'
const OUT = path.join(ROOT, '..', OUT_NAME)
const ZIP = path.join(ROOT, OUT_NAME + '.zip')
const CRX = path.join(ROOT, OUT_NAME + '.crx')
const KEY = path.join(ROOT, 'key.pem')

const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB'

const buildCrx = () =>
  new Promise((resolve, reject) => {
    const crx3 = require('crx3')
    crx3(fs.createReadStream(ZIP), { keyPath: KEY, crxPath: CRX })
      .then((info) => resolve(info))
      .catch(reject)
  })

const main = async () => {
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

  // crx3 需要目录里存在 manifest.json（它靠这个算 app id）
  if (!fs.existsSync(path.join(OUT, 'manifest.json'))) {
    console.error(OUT + ' 里没有 manifest.json，crx 算不出 app id')
    process.exit(1)
  }

  console.log('→ 生成 crx（crx3，自签名）…')
  let info
  try {
    info = await buildCrx()
  } catch (e) {
    console.error('crx 生成失败：' + (e && e.message ? e.message : e))
    console.error('不影响使用，Chrome 里走「开发者模式 → 加载已解压的扩展程序」，指向：')
    console.error('  ' + OUT)
    process.exit(2)
  }

  const size = fs.statSync(CRX).size
  const head = fs.readFileSync(CRX).slice(0, 4).toString('latin1')
  console.log('')
  console.log('crx  ->', CRX, mb(size))
  console.log('头部 ->', JSON.stringify(head), head === 'Cr24' ? '（CRX3 格式，Chrome 64+ 可识别）' : '（格式异常！）')
  console.log('appId->', info.appId)
  if (info.newKey) console.log('新私钥->', info.newKey, '（保存在仓库根，别提交，别丢，丢了就更新不了）')
  else console.log('私钥->', KEY, '（复用已有密钥，下次打 crx 还是同一个 app id）')
  console.log('')
  console.log('装法：把 crx 拖到 chrome://extensions/ 上即可（Chrome 会提示「无法验证此次安装」，点继续安装）。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
