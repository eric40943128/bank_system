'use strict'
const { Service } = require('egg')

class TransactionService extends Service {
  // 存款
  async deposit(userId, amount) {
    const { ctx, app } = this
    const user = await ctx.model.User.findByPk(userId)
    let response
    const depositAmount = Number(amount)

    if (!user) {
      response = { success: false, message: '用戶不存在' }
    } else if (isNaN(depositAmount) || depositAmount <= 0) {
      response = { success: false, message: '存款金額無效' }
    } else {
      // **更新餘額**
      user.balance = Number(user.balance) + depositAmount
      user.updatedAt = new Date() // 確保 `updatedAt` 更新
      await user.save()

      // **更新 Redis 快取**
      const redisKey = `user_balance:${userId}`
      await app.redis.set(redisKey, user.balance, 'EX', 60 * 60)

      // **將 `balance` 存入 Transaction 表**
      await ctx.model.Transaction.create({
        userId: user.id,
        type: '存款',
        amount: depositAmount,
        balance: user.balance,
      })

      // 使用 `SCAN` 找到所有匹配的 `transaction_history:${userId}:*` Key，然後刪除
      let cursor = '0'
      do {
        const scanResult = await app.redis.scan(cursor, 'MATCH', `transaction_history:${userId}:*`, 'COUNT', 100)
        cursor = scanResult[0]
        const keysToDelete = scanResult[1]

        if (keysToDelete.length > 0) {
          await app.redis.del(...keysToDelete)
        }
      } while (cursor !== '0') // 確保完整掃描 Redis

      response = { success: true, message: '存款成功', balance: user.balance }
    }

    return response
  }

  // 提款
  async withdraw(userId, amount) {
    const { ctx, app } = this
    const user = await ctx.model.User.findByPk(userId)
    const withdrawAmount = Number(amount)
    let response

    if (!user) {
      response = { success: false, message: '使用者不存在' }
    } else if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      response = { success: false, message: '提款金額錯誤' }
    } else if (user.balance < withdrawAmount) {
      response = { success: false, message: '餘額不足' }
    } else {
      user.balance = Number(user.balance) - withdrawAmount
      user.updatedAt = new Date()
      await user.save()

      const redisKey = `user_balance:${userId}`
      await app.redis.set(redisKey, user.balance, 'EX', 60 * 60)

      await ctx.model.Transaction.create({
        userId: user.id,
        type: '提款',
        amount: withdrawAmount,
        balance: user.balance,
      })

      // 使用 `SCAN` 找到所有匹配的 `transaction_history:${userId}:*` Key，然後刪除
      let cursor = '0'
      do {
        const scanResult = await app.redis.scan(cursor, 'MATCH', `transaction_history:${userId}:*`, 'COUNT', 100)
        cursor = scanResult[0]
        const keysToDelete = scanResult[1]

        if (keysToDelete.length > 0) {
          await app.redis.del(...keysToDelete)
        }
      } while (cursor !== '0') // 確保完整掃描 Redis

      response = { success: true, message: '提款成功', balance: user.balance }
    }

    return response
  }

  // 交易紀錄查詢
  async getTransactionHistory(userId, startDate, endDate) {
    const { ctx, app } = this
    let response

    const redisKey = `transaction_history:${userId}:${startDate}:${endDate}`

    const cachedTransactions = await app.redis.get(redisKey)
    if (cachedTransactions) {
      response = { success: true, transactions: JSON.parse(cachedTransactions) }
    } else {
      const { Op } = ctx.app.Sequelize

      const transactions = await ctx.model.Transaction.findAll({
        where: {
          userId,
          createdAt: {
            [Op.between]: [ new Date(startDate), new Date(endDate) ],
          },
        },
        attributes: [
          'id',
          'userId',
          'type',
          'amount',
          'balance',
          [ ctx.app.Sequelize.fn('DATE_FORMAT', ctx.app.Sequelize.col('BankTransaction.createdAt'), '%Y-%m-%d %H:%i:%s'), 'createdAt' ],
        ],
        order: [[ ctx.app.Sequelize.col('BankTransaction.createdAt'), 'DESC' ]],
        raw: true,
      })

      if (transactions.length > 0) {
        await app.redis.set(redisKey, JSON.stringify(transactions), 'EX', 60 * 60)
      }

      response = { success: true, transactions }
    }

    return response
  }
}

module.exports = TransactionService
