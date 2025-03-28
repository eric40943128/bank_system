'use strict'

module.exports = appInfo => {
  const config = {}

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
   * Sequelize 設定
   */
  config.sequelize = {
    dialect: 'mysql', // 使用 MySQL
    host: '127.0.0.1',
    port: 3306,
    database: 'bank_system',
    username: 'root',
    password: 'eric910831',
    timezone: '+08:00', // 設定時區，避免時差問題
    define: {
      freezeTableName: true, // 禁止 Sequelize 自動修改表名
      timestamps: true, // 啟用 createdAt / updatedAt
    },
    sync: { force: false }, // **如果是 `true`，每次啟動都會刪除並重建表**
    pool: {
      max: 50, // 最大連線數，可根據硬體資源調整
      min: 0, // 最小連線數
      acquire: 30000, // 連線最大等待時間（毫秒）
      idle: 10000, // 連線空閒最大時間（毫秒）
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

  /**
   * View 設定
   */
  config.view = {
    mapping: { '.html': 'nunjucks' },
  }

  /**
   * Security 設定
   */
  config.security = {
    csrf: {
      enable: false,
      headerName: 'x-csrf-token', // 與前端的 Header 名稱保持一致
    },
  }

  /**
   * 靜態資源設定
   */
  config.static = {
    prefix: '/',
    dir: path.join(appInfo.baseDir, 'app/public'),
  }

  /**
   * Cluster 設定
   */
  config.cluster = {
    listen: {
      port: 7001,
      hostname: '0.0.0.0',
    },
  }

  return config
}
