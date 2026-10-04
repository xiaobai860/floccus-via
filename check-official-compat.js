#!/usr/bin/env node
/**
 * 官方格式对等回归
 *
 * 要回答问题只有一个：
 *   「不打开 Via 兼容开关时，这个 fork 产出的书签文件，和官方 floccus 逐字节一样吗？」
 *
 * 答案不是"看代码应该一样"，是量出来的：
 * 拿上游 v5.11.1 纯净源码（git worktree detached 944fc3e）跑同一个入口，
 * 与本分支跑出来的输出 sha256 完全相同（33ea98f5… / 39147 字节）。
 *
 * 所以这里把这个指纹存成常量当基线。以后同步上游时如果跑出不一样的值，
 * 说明上游改了官方序列化格式，或者我们的改动漫过了 via 分支污染了官方路径 ——
 * 必须停下来评估，别让它悄悄跟着变，Via 那边可能就同步炸了。
 *
 * 用法：
 *   node check-official-compat.js
 *   BOOKMARK_FILE="E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html" node check-official-compat.js
 */

const crypto = require('crypto')
const path = require('path')
const webpack = require('webpack')

// 官方 floccus 5.11.1 在「非 Via 模式」下序列化 floccus 导出文件的输出指纹
const BASELINE_SHA = '33ea98f52387b3c5960c2e6f2b78c7c72a2eecf2114a04c39e971122decdead0'
const BASELINE_BYTES = 39147

const BOOKMARK_FILE =
  process.env.BOOKMARK_FILE ||
  process.env.FLOCCUS_FILE ||
  'E:/Users/xiaom/Downloads/floccus-2026-10-03.export.html'

const BUNDLE = path.join(__dirname, 'dist', 'official-check', 'bundle.js')

// bundle 里读的是 process.env.BOOKMARK_FILE，这里把兜底路径灌进去
process.env.BOOKMARK_FILE = BOOKMARK_FILE

/** 依次：进程内编译 → require 生成的 bundle 并捕获它写到 stdout 的字节 */
function serializeOnce() {
  return new Promise((resolve, reject) => {
    const config = require('./webpack.official-check.js')
    webpack(config, (err, stats) => {
      if (err) return reject(err)
      if (stats.hasErrors()) {
        return reject(new Error(stats.toString({ all: false, errors: true })))
      }
      // require 一个 target=node 的 CJS bundle 会直接执行它，
      // 输出通过 process.stdout.write 出去，这里临时截下来。
      const origWrite = process.stdout.write.bind(process.stdout)
      let captured = ''
      process.stdout.write = (chunk, ...rest) => {
        captured += chunk
        return true
      }
      try {
        delete require.cache[require.resolve(BUNDLE)]
        require(BUNDLE)
      } finally {
        process.stdout.write = origWrite
      }
      resolve(Buffer.from(captured, 'utf8'))
    })
  })
}

;(async () => {
  process.stdout.write('→ 编译官方格式对等入口…\n')
  const buf = await serializeOnce()

  const sha = crypto.createHash('sha256').update(buf).digest('hex')
  const ok = (cond, msg) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
    return cond
  }

  console.log(`\n输入：${BOOKMARK_FILE}`)
  console.log(`输出：${buf.length} 字节  sha256=${sha}\n`)

  const results = [
    ok(buf.length === BASELINE_BYTES, `输出字节数与官方基准一致（${buf.length} / ${BASELINE_BYTES}）`),
    ok(sha === BASELINE_SHA, `输出 sha256 与官方 floccus 5.11.1 逐字节一致`),
  ]

  if (sha !== BASELINE_SHA) {
    console.log('\n⚠️  不对等！两种可能：')
    console.log('   1) 上游改了官方序列化格式（ID / TAGS / 缩进…）—— 要判断 Via 那边要不要跟')
    console.log('   2) 我们的 Via 改动漫过了 via 分支，污染了官方路径 —— 必须查')
    console.log('   排查：拿 dist/official-check 的输出跟 git show 上游版本序列化的结果对比。')
  }

  const allOk = results.every(Boolean)
  console.log(`\n${allOk ? 'ALL PASS  不开 Via 开关时，输出与官方 floccus 完全一致。' : 'FAILED'}`)
  process.exit(allOk ? 0 : 1)
})().catch((e) => {
  console.error('✗ ' + (e && e.message ? e.message : e))
  process.exit(1)
})
