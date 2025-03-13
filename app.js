'use strict'

module.exports = app => {
  app.beforeStart(async () => {
    try {
      // 測試 Redis 連接是否成功
      const result = await app.redis.set('test_key', 'test_value')
      console.log('Redis 連接成功:', result) // 預期顯示 'OK'
    } catch (error) {
      console.error('Redis 連接失敗:', error)
    }
  })
}
