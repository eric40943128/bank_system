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

  describe('deposit()', () => {
    it('應該成功存款', async () => {
      const result = await ctx.service.transaction.deposit(user, 500)
      assert.deepStrictEqual(result, { success: true, message: '存款成功', balance: 1500 })
    })
  })

  describe('withdraw()', () => {
    it('應該成功提款', async () => {
      const result = await ctx.service.transaction.withdraw(user, 300)
      assert.deepStrictEqual(result, { success: true, message: '提款成功', balance: 700 })
    })
  })

  describe('getTransactionHistory()', () => {
    it('應該從資料庫查詢交易紀錄並回傳', async () => {
      await ctx.model.Transaction.create({
        userId: user.id,
        type: '提款',
        amount: '300.00',
        balance: '700.00',
        createdAt: new Date('2025-03-24 10:00:00'),
      })

      const result = await ctx.service.transaction.getTransactionHistory(
        user.id,
        '2025-01-01 00:00:00',
        '2025-12-31 23:59:59'
      )

      assert.deepStrictEqual(result.success, true)
    })
  })

  describe('validateAmount()', () => {
    it('應該驗證失敗：餘額不足', () => {
      const result = ctx.service.transaction.validateAmount(user, 2000, 'withdraw')
      assert.deepStrictEqual(result, { success: false, message: '餘額不足' })
    })

    it('應該驗證失敗：金額無效', () => {
      const result = ctx.service.transaction.validateAmount(user, -100, 'deposit')
      assert.deepStrictEqual(result, { success: false, message: '存款金額無效' })
    })

    it('應該驗證成功：金額有效', () => {
      const result = ctx.service.transaction.validateAmount(user, 100, 'deposit')
      assert.deepStrictEqual(result, { success: true })
    })
  })

  describe('getTransactionCacheKey()', () => {
    it('應該回傳正確的 Redis Key', () => {
      const key = ctx.service.transaction.getTransactionCacheKey(user.id, '2025-01-01', '2025-12-31')
      assert.deepStrictEqual(key, `transaction_history:${user.id}:2025-01-01:2025-12-31`)
    })
  })

  describe('getCachedTransactions()', () => {
    it('應該回傳 Redis 中的快取交易紀錄', async () => {
      const redisKey = ctx.service.transaction.getTransactionCacheKey(user.id, '2025-01-01', '2025-12-31')
      const cachedData = [
        { userId: user.id, type: '存款', amount: '1000.00', balance: '2000.00', createdAt: '2025-01-01 00:00:00' },
      ]
      await app.redis.set(redisKey, JSON.stringify(cachedData))

      const result = await ctx.service.transaction.getCachedTransactions(redisKey)
      assert.deepStrictEqual(result, cachedData)
    })
  })

  describe('fetchTransactionsFromDB()', () => {
    it('應該查詢資料庫中的交易紀錄', async () => {
      const transaction = await ctx.model.Transaction.create({
        userId: user.id,
        type: '存款',
        amount: '500.00',
        balance: '1500.00',
        createdAt: new Date('2025-03-24 10:00:00'),
      })

      const result = await ctx.service.transaction.fetchTransactionsFromDB(
        user.id,
        '2025-01-01 00:00:00',
        '2025-12-31 23:59:59'
      )

      const expected = [
        {
          id: transaction.id,
          userId: user.id,
          type: '存款',
          amount: '500.00',
          balance: '1500.00',
          createdAt: '2025-03-24 10:00:00',
        },
      ]

      assert.deepStrictEqual(result, expected)
    })
  })

  describe('cacheTransactions()', () => {
    it('應該將交易資料快取至 Redis', async () => {
      const redisKey = ctx.service.transaction.getTransactionCacheKey(user.id, '2025-01-01', '2025-12-31')
      const transactions = [
        { userId: user.id, type: '存款', amount: '1000.00', balance: '2000.00', createdAt: '2025-01-01 00:00:00' },
      ]

      await ctx.service.transaction.cacheTransactions(redisKey, transactions)
      const redisResult = await app.redis.get(redisKey)
      assert.deepStrictEqual(JSON.parse(redisResult), transactions)
    })
  })

  describe('updateUserBalance()', () => {
    it('應該更新用戶餘額並寫入 Redis', async () => {
      await ctx.service.transaction.updateUserBalance(user, 500, 'deposit')
      const updatedUser = await ctx.model.User.findByPk(user.id)
      const redisBalance = await app.redis.get(`user_balance:${user.id}`)
      assert.deepStrictEqual(Number(redisBalance), Number(updatedUser.balance))
    })
  })

  describe('saveTransaction()', () => {
    it('應該儲存存款交易紀錄', async () => {
      await ctx.service.transaction.saveTransaction(user.id, 100, 1100, 'deposit')
      const transactionRecord = await ctx.model.Transaction.findOne({ where: { userId: user.id, type: '存款' } })

      const transactionData = {
        userId: transactionRecord.userId,
        type: transactionRecord.type,
        amount: transactionRecord.amount,
        balance: transactionRecord.balance,
      }

      const expected = {
        userId: user.id,
        type: '存款',
        amount: '100.00',
        balance: '1100.00',
      }
      assert.deepStrictEqual(transactionData, expected)
    })

    it('應該儲存提款交易紀錄', async () => {
      await ctx.service.transaction.saveTransaction(user.id, 50, 950, 'withdraw')
      const transactionRecord = await ctx.model.Transaction.findOne({ where: { userId: user.id, type: '提款' } })

      const transactionData = {
        userId: transactionRecord.userId,
        type: transactionRecord.type,
        amount: transactionRecord.amount,
        balance: transactionRecord.balance,
      }

      const expected = {
        userId: user.id,
        type: '提款',
        amount: '50.00',
        balance: '950.00',
      }
      assert.deepStrictEqual(transactionData, expected)
    })

  })

  describe('clearTransactionCache()', () => {
    it('應該刪除 Redis 快取的交易紀錄', async () => {
      const redisKey = `transaction_history:${user.id}:*`
      await app.redis.set(redisKey, JSON.stringify([{ type: '存款', amount: 1000, balance: 2000 }]))

      await ctx.service.transaction.clearTransactionCache(user.id)

      const keys = await app.redis.keys(redisKey)
      assert.deepStrictEqual(keys, [])
    })
  })
})
