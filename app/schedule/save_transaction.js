'use strict'

const Subscription = require('egg').Subscription

class SaveTransactionLogSchedule extends Subscription {
  static get schedule() {
    return {
      interval: '1s',
      type: 'worker', // 只讓一台 worker 跑
    }
  }

  async subscribe() {
    const { app } = this
    const MAX_BATCH_SIZE = 2000
    const batchList = []

    for (let i = 0; i < MAX_BATCH_SIZE; i++) {
      const transaction = await app.redis.lpop('transaction_list')
      if (!transaction) {
        break
      }
      batchList.push(JSON.parse(transaction))
    }

    if (batchList.length === 0) {
      return
    }

    try {
      await app.model.Transaction.bulkCreate(batchList)
      app.logger.info(`[TransactionLog] ✅ 批次寫入 ${batchList.length} 筆交易紀錄`)
    } catch (err) {
      app.logger.error('[TransactionLog] ❌ 批次寫入失敗:', err)
      for (const transaction of batchList) {
        await app.redis.rpush('transaction_list_failed', JSON.stringify(transaction))
      }
    }
  }
}

module.exports = SaveTransactionLogSchedule
