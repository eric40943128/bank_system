const path = require('path')
const model = require(path.join(__dirname, 'app', 'model')) // 正確的模型路徑
const Sequelize = require('sequelize') // 確認正確引入 Sequelize

module.exports = app => {
  app.beforeStart(async () => {
    console.log('🔗 手動綁定模型到 app.model...')

    // 確保模型綁定到 app.model
    app.model = model

    // 綁定 Sequelize 到 app
    app.Sequelize = Sequelize

    // 驗證模型是否成功加載
    if (app.model && Object.keys(app.model).length > 0) {
      console.log('✅ 綁定成功的模型:', Object.keys(app.model))
    } else {
      console.error('❌ ctx.model 未正確加載，可能模型初始化失敗')
    }

    try {
      // 測試 Redis 連接是否成功
      const result = await app.redis.set('test_key', 'test_value')
      console.log('Redis 連接成功:', result) // 預期顯示 'OK'
    } catch (error) {
      console.error('Redis 連接失敗:', error)
    }
  })

  // 設定自訂的 Redis Session Store
  app.sessionStore = {
    async get(key) {
      const res = await app.redis.get(key)
      if (!res) { return null }

      return JSON.parse(res)
    },
    async set(key, value, maxAge) {
      maxAge = maxAge || 24 * 3600 * 1000 // 默認一天
      value = JSON.stringify(value)
      await app.redis.set(key, value, 'PX', maxAge)
    },
    async destroy(key) {
      await app.redis.del(key)
    },
  }

  // 確保在每個請求中，ctx.model 正確綁定
  app.middleware.unshift(async (ctx, next) => {
    ctx.model = app.model
    ctx.Sequelize = app.Sequelize
    await next()
  })
}
