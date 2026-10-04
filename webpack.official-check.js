/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const webpack = require('webpack')

// 临时用的打包配置，只为跑 src/entries/official-compat.js（官方格式对等验证）
// 复用 webpack.via-check.js 的 loader / alias 设置，保证两边编译环境一致，
// 否则"字节一致"这个结论会被编译差异带偏。
module.exports = {
  mode: 'development',
  target: 'node',
  devtool: false,
  entry: {
    bundle: path.join(__dirname, 'src', 'entries', 'official-compat.js'),
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'official-check'),
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: { loader: 'ts-loader', options: { transpileOnly: true } },
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.ts', '.json'],
    alias: {
      '@capacitor/preferences': path.resolve(
        __dirname,
        'src',
        'test',
        'node-shims',
        'capacitor-preferences.js'
      ),
      '@capacitor/share': path.resolve(
        __dirname,
        'src',
        'test',
        'node-shims',
        'capacitor-share.js'
      ),
      '@capacitor/filesystem': path.resolve(
        __dirname,
        'src',
        'test',
        'node-shims',
        'capacitor-filesystem.js'
      ),
      '@capacitor-community/sqlite': path.resolve(
        __dirname,
        'src',
        'test',
        'node-shims',
        'capacitor-sqlite.js'
      ),
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      BROWSERSLIST_REGEX: require('./supportedBrowsers'),
      IS_BROWSER: 'false',
    }),
  ],
}
