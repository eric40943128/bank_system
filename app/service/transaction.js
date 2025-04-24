'use strict'
const { Service } = require('egg')
const fs = require('fs')
const path = require('path')
const Decimal = require('decimal.js')

const LUA_UPDATE_SCRIPT = fs.readFileSync(
  path.resolve(__dirname, '../redis-scripts/update_balance.lua'),
  'utf8'
)

class TransactionService extends Service {
  // 存款
  async deposit(user, amount) {
    const type = 'deposit'

    // 更新用戶餘額並加入交易紀錄佇列
    const balance = await this.processTransaction(user.id, amount, type)

    // 清除交易紀錄快取
    await this.clearTransactionCache(user.id)

    return { success: true, message: '存款成功', balance }
  }

  // 提款
  async withdraw(user, amount) {
    const type = 'withdraw'

    // 更新用戶餘額並加入交易紀錄佇列
    const balance = await this.processTransaction(user.id, amount, type)

    // 清除交易紀錄快取
    await this.clearTransactionCache(user.id)

    return { success: true, message: '提款成功', balance }
  }

  // 交易紀錄查詢
  async getTransactionHistory(userId, startDate, endDate) {
    let response
    const redisKey = this.getTransactionCacheKey(userId, startDate, endDate)

    // 先嘗試從 Redis 讀取快取
    const cachedTransactions = await this.getCachedTransactions(redisKey)
    if (cachedTransactions) {
      response = { success: true, transactions: cachedTransactions }
    } else {
      // 從資料庫查詢
      const transactions = await this.fetchTransactionsFromDB(userId, startDate, endDate)

      // 若查詢結果有數據，則存入 Redis
      if (transactions.length > 0) {
        await this.cacheTransactions(redisKey, transactions)
      }

      response = { success: true, transactions }
    }

    return response
  }

  // 驗證金額
  validateAmount(user, amount, type) {
    let response = { success: true }
    if (isNaN(amount) || amount <= 0) {
      response = { success: false, message: '存款金額無效' }
    }
    if (!Number.isInteger(amount * 100)) {
      return { success: false, message: '金額最多只能輸入到小數點後兩位' }
    }
    if (type === 'withdraw' && user.balance < amount) {
      response = { success: false, message: '餘額不足' }
    }

    return response
  }

  // 取得交易快取鍵
  getTransactionCacheKey(userId, startDate, endDate) {
    return `transaction_history:${userId}:${startDate}:${endDate}`
  }

  // 嘗試從 Redis 讀取快取
  async getCachedTransactions(redisKey) {
    const { app } = this
    const cachedData = await app.redis.get(redisKey)

    return cachedData ? JSON.parse(cachedData) : null
  }

  // 從資料庫查詢交易紀錄
  async fetchTransactionsFromDB(userId, startDate, endDate) {
    const { ctx } = this
    const { Op } = ctx.app.Sequelize

    return await ctx.model.Transaction.findAll({
      where: {
        userId,
        createdAt: { [Op.between]: [ new Date(startDate), new Date(endDate) ] },
      },
      attributes: [
        'id',
        'userId',
        'type',
        'amount',
        'balance',
        [ ctx.app.Sequelize.fn('DATE_FORMAT', ctx.app.Sequelize.col('createdAt'), '%Y-%m-%d %H:%i:%s'), 'createdAt' ],
      ],
      order: [[ ctx.app.Sequelize.col('createdAt'), 'DESC' ]],
      raw: true,
    })
  }

  // 存入 Redis 快取
  async cacheTransactions(redisKey, transactions) {
    const { app } = this
    await app.redis.set(redisKey, JSON.stringify(transactions), 'EX', 60 * 60) // 快取 1 小時
  }

  // 更新用戶餘額並加入交易紀錄佇列
  async processTransaction(userId, amount, type) {
    const { ctx } = this

    // 將浮點數轉為整數準備進行操作
    const transactionAmount = await this.convertAmountToInteger(type === 'deposit' ? amount : -amount)
    const redisKey = `user_key:${userId}`

    // 使用 Lua 腳本執行 balance + opId 的原子操作
    let [ balance, opId ] = await ctx.app.redis.eval(
      LUA_UPDATE_SCRIPT,
      1,
      redisKey,
      transactionAmount
    )

    if (balance === -1) {
      throw new Error('餘額不足')
    }

    // 將操作後的金額轉回浮點數做後續處理
    balance = new Decimal(balance).div(100)

    // 將同步任務加入 Redis List（使用 JSON 格式）
    await ctx.app.redis.rpush('balance_sync_list', JSON.stringify({
      id: userId,
      balance,
      opId,
    }))

    // 將交易紀錄寫入加入 Redis List
    await ctx.app.redis.rpush('transaction_list', JSON.stringify({
      userId,
      amount,
      type: type === 'deposit' ? '存款' : '提款',
      balance,
    }))

    return balance
  }

  // 把即將處理的操作金額轉為整數（為搭配incrby）
  async convertAmountToInteger(amount) {
    try {
      const decimalAmount = new Decimal(amount)

      return decimalAmount.mul(100).toNumber()
    } catch (err) {
      throw new Error(`Invalid amount format: ${amount}`)
    }
  }

  // 清除快取
  async clearTransactionCache(userId) {
    const { app } = this
    let cursor = '0'
    do {
      const scanResult = await app.redis.scan(cursor, 'MATCH', `transaction_history:${userId}:*`, 'COUNT', 100)
      cursor = scanResult[0]
      const keysToDelete = scanResult[1]

      if (keysToDelete.length > 0) {
        await app.redis.del(...keysToDelete)
      }
    } while (cursor !== '0')
  }
}

module.exports = TransactionService
