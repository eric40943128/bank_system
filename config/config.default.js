'use strict'

module.exports = appInfo => {
  const config = (exports = {})
  const path = require('path')

  // Cookie 加密 key
  config.keys = appInfo.name + '_1739845528100_7391'

  // 中間件設定
  config.middleware = []

  /**
   * Redis 設定
   */
  config.redis = {
    client: {
      host: '127.0.0.1',
      port: 6379,
      password: '',
      db: 0,
    },
  }

  /**
   * Session 設定 (不手動指定 store)
   */
  config.session = {
    key: 'EGG_SESS',
    maxAge: 24 * 3600 * 1000, // 1 天
    httpOnly: true,
    encrypt: true,
  }

  config.view = {
    mapping: { '.html': 'nunjucks' },
  }

  config.security = {
    csrf: {
      enable: true,
      headerName: 'x-csrf-token', // 與前端的 Header 名稱保持一致
    },
  }
  config.static = {
    prefix: '/',
    dir: path.join(appInfo.baseDir, 'app/public'),
  }

  config.cluster = {
    listen: {
      port: 7001,
      hostname: '0.0.0.0',
    },
  }

  return {
    ...config,
  }
}
