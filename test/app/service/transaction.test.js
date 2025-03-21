const assert = require('assert')
const { app } = require('egg-mock/bootstrap')

describe('TransactionService', () => {
  let ctx
  let user

  beforeEach(async () => {
    ctx = app.mockContext()
    // 建立測試用使用者
    user = await ctx.model.User.create({
      username: 'test_user_tx',
      password: '12345',
      balance: 1000,
    })
  })

  it('應該刪除 Redis 快取的交易紀錄', async () => {
    const redisKey = `transaction_history:${user.id}:*`
    await app.redis.set(redisKey, JSON.stringify([{ type: '存款', amount: 1000, balance: 2000 }]))

    await ctx.service.transaction.clearTransactionCache(user.id)

    const keys = await app.redis.keys(redisKey)
    assert.strictEqual(keys.length, 0)
  })
})
