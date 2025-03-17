'use strict'
const { Service } = require('egg')

class TransactionService extends Service {
  // 存款
  async deposit(user, amount) {
    const depositAmount = Number(amount)
    const type = 'deposit'

    // 更新用戶餘額
    await this.updateUserBalance(user, depositAmount, type)

    // 儲存交易紀錄
    await this.saveTransaction(user.id, depositAmount, user.balance, type)

    // 清除交易紀錄快取
    await this.clearTransactionCache(user.id)

    return { success: true, message: '存款成功', balance: user.balance }
  }

  // 提款
  async withdraw(user, amount) {
    const withdrawAmount = Number(amount)
    const type = 'withdraw'

    // 更新用戶餘額
    await this.updateUserBalance(user, withdrawAmount, type)

    // 儲存交易紀錄
    await this.saveTransaction(user.id, withdrawAmount, user.balance, type)

    // 清除交易紀錄快取
    await this.clearTransactionCache(user.id)

    return { success: true, message: '提款成功', balance: user.balance }
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
    let response = null
    if (isNaN(amount) || amount <= 0) {
      response = { success: false, message: '存款金額無效' }
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

  // 更新用戶餘額
  async updateUserBalance(user, amount, type) {
    const { app } = this
    if (type === 'deposit') {
      user.balance = Number(user.balance) + amount
    } else if (type === 'withdraw') {
      user.balance = Number(user.balance) - amount
    }
    user.updatedAt = new Date()
    await user.save()

    const redisKey = `user_balance:${user.id}`
    await app.redis.set(redisKey, user.balance, 'EX', 60 * 60)
  }

  // 儲存交易紀錄
  async saveTransaction(userId, amount, balance, type) {
    if (type === 'deposit') {
      await this.ctx.model.Transaction.create({
        userId,
        type: '存款',
        amount,
        balance,
      })
    } else if (type === 'withdraw') {
      await this.ctx.model.Transaction.create({
        userId,
        type: '提款',
        amount,
        balance,
      })
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
