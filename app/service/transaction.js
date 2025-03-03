'use strict'
const { Service } = require('egg')

class TransactionService extends Service {
  // 存款
  async deposit(userId, amount) {
    const { ctx, app } = this
    const user = await ctx.model.User.findByPk(userId)

    if (!user) {
      return { success: false, message: '用戶不存在' }
    }

    const depositAmount = Number(amount)
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return { success: false, message: '存款金額無效' }
    }

    user.balance = Number(user.balance) + depositAmount
    await user.save()

    const redisKey = `user_balance:${userId}`
    await app.redis.set(redisKey, user.balance, 'EX', 60 * 60)

    await ctx.model.BankTransaction.create({
      userId: user.id,
      type: '存款',
      amount: depositAmount,
      balance: user.balance,
      timestamp: new Date(),
    })

    return { success: true, message: '存款成功', balance: user.balance }
  }
  // 提款
  async withdraw(userId, amount) {
    const { ctx, app } = this
    const user = await this.ctx.model.User.findByPk(userId)

    if (!user) {
      return { success: false, message: '使用者不存在' }
    }

    const withdrawAmout = Number(amount)
    if (isNaN(withdrawAmout) || withdrawAmout <= 0) {
      return { success: false, message: '提款金額錯誤' }
    }

    if (user.balance < withdrawAmout) {
      return { success: false, message: '餘額不足' }
    }

    user.balance = Number(user.balance) - withdrawAmout
    await user.save()

    const redisKey = `user_balance:${userId}`
    await app.redis.set(redisKey, user.balance, 'EX', 60 * 60)

    await ctx.model.BankTransaction.create({
      userId: user.id,
      type: '提款',
      amount: withdrawAmout,
      balance: user.balance,
      timestamp: new Date(),
    })

    return { success: true, message: '提款成功', balance: user.balance }
  }
  // 交易紀錄查詢
  async getTransactionHistory(userId, startDate, endDate) {
    const { ctx, app } = this
    console.log('接收到的參數:', { userId, startDate, endDate })

    const redisKey = `transaction_history:${userId}:${startDate}:${endDate}`

    // 每次查詢時先刪除快取，確保獲取最新資料
    await app.redis.del(redisKey)

    const cachedTransactions = await app.redis.get(redisKey)
    if (cachedTransactions) {
      console.log('從 Redis 快取取得交易紀錄')

      return { success: true, transactions: JSON.parse(cachedTransactions) }
    }

    const parseDate = dateStr => {
      const [ datePart, timePart ] = dateStr.split(' ')
      const [ year, month, day ] = datePart.split('-').map(Number)
      const [ hour, minute, second ] = timePart ? timePart.split(':').map(Number) : [ 0, 0, 0 ]

      return new Date(year, month - 1, day, hour, minute, second)
    }

    const start = parseDate(startDate)
    const end = parseDate(endDate)
    console.log('解析後的參數:', { start, end })

    if (isNaN(start) || isNaN(end)) {
      return { success: false, message: '日期格式無效' }
    }

    // 正確使用 Sequelize 的 Op
    const { Op } = ctx.Sequelize
    console.log('Sequelize Op 載入成功:')

    const transactions = await ctx.model.BankTransaction.findAll({
      where: {
        userId,
        createdAt: {
          [Op.between]: [ startDate, endDate ],
        },
      },
      attributes: [ 'id', 'userId', 'type', 'amount', 'createdAt' ],
      order: [[ 'createdAt', 'DESC' ]],
    })

    // 將查詢結果快取至 Redis，設置有效期 60 分鐘
    await app.redis.set(redisKey, JSON.stringify(transactions), 'EX', 60 * 60)

    return { success: true, transactions }
  }
}

module.exports = TransactionService
