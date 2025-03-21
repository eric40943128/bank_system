const { FlatCompat } = require('@eslint/eslintrc') // 兼容舊版 ESLint 設定

const compat = new FlatCompat() // 建立相容設定

module.exports = [
  {
    ignores: [ 'node_modules', 'dist', 'logs' ],
  },

  // 確保正確載入 eslint-config-egg
  ...compat.extends('egg'), // 簡化載入方式

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        console: 'readonly',
      },
    },
    rules: {
      semi: [ 'error', 'never' ], //  不使用分號
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: '*', next: 'return' }, // return 上方要空行
      ],
      'newline-before-return': 'off', // function 內只有一行 return 不用空行
      curly: [ 'error', 'all' ], // 強制所有 if、else、for、while 需要 {}
      'no-restricted-modules': 'off', // require('fs'), require('path')
    },
  },
]
