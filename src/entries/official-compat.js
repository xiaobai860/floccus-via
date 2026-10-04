/* eslint-disable no-console */
// 对等验证：不开 Via 兼容时，序列化结果必须和官方 floccus 5.11.1 逐字节一致。
//
// 用法：
//   npx webpack --config webpack.official-check.js
//   BOOKMARK_FILE="E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html" \
//       node dist/official-check/bundle.js > out.html
//   sha256sum out.html
//
// 这个脚本故意不传 viaCompatible（走 DEFAULT_OPTIONS.viaCompatible === false，
// 也就是官方路径）。把它和上游原版代码跑出来的输出对比，就知道 Via 改造
// 有没有污染官方格式 —— 这是"不开开关就还是原版"的硬证据。
import fs from 'fs'
import Html from '../lib/serializers/Html'

const FILE = process.env.BOOKMARK_FILE
if (!FILE) {
  console.error('BOOKMARK_FILE 环境变量没设')
  process.exit(2)
}

const text = fs.readFileSync(FILE, 'utf8')
// 默认走官方路径：不传 options，viaCompatible 默认 false
const viaMode = process.env.VIA_MODE === '1'
const opts = viaMode ? { viaCompatible: true } : {}
const root = Html.deserialize(text, opts)
const out = Html.serialize(root, opts)

console.error(`输入字节 ${Buffer.byteLength(text)}，输出字节 ${Buffer.byteLength(out)}`)
process.stdout.write(out)
