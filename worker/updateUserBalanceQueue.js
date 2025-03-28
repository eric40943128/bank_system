'use strict'

const Queue = require('bull')
const Sequelize = require('sequelize')
const Redis = require('ioredis')
const redis = new Redis()

// 初始化資料庫
const sequelize = new Sequelize('bank_system', 'root', 'eric910831', {
  host: '127.0.0.1',
  dialect: 'mysql',
  timezone: '+08:00',
  dialectOptions: {
    useUTC: false,
    dateStrings: true,
    typeCast: true,
  },
})

const User = sequelize.define('User', {
  id: { type: Sequelize.INTEGER, primaryKey: true },
  balance: Sequelize.DECIMAL(20, 2),
}, {
  tableName: 'users',
  timestamps: true,
})

const Transaction = sequelize.define('Transaction', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  userId: Sequelize.INTEGER,
  type: Sequelize.STRING,
  amount: Sequelize.DECIMAL(20, 2),
  balance: Sequelize.DECIMAL(20, 2),
}, {
  tableName: 'transactions',
  timestamps: true,
})

const queue = new Queue('update-user-balance-queue', {
  redis: { host: '127.0.0.1', port: 6379 },
})

queue.process(1, async job => {
  const { userId, type, amount } = job.data

  try {

    await sequelize.transaction(async transaction => {
      const user = await User.findByPk(userId, { transaction })

      const newBalance = type === 'deposit'
        ? Number(user.balance) + Number(amount)
        : Number(user.balance) - Number(amount)

      await user.update({ balance: newBalance }, { transaction })

      await Transaction.create({
        userId,
        type: type === 'deposit' ? '存款' : '提款',
        amount,
        balance: newBalance,
      }, { transaction })

      const redisKey = `user_balance:${userId}`
      await redis.set(redisKey, newBalance, 'EX', 60 * 60)
    })
  } catch (err) {
    console.error(`[Bull] ❌ 處理失敗: userId=${userId}, type=${type}, amount=${amount}`, err)
  }
})
