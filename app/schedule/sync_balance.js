'use strict'

const Subscription = require('egg').Subscription

class SyncBalanceSchedule extends Subscription {
  static get schedule() {
    return {
      interval: '1s',
      type: 'worker',
    }
  }

  async subscribe() {
    const { app } = this
    const redis = app.redis

    try {
      const balanceUpdateList = []
      const BATCH_SIZE = 1000

      for (let i = 0; i < BATCH_SIZE; i++) {
        const balanceUpdateData = await redis.lpop('balance_sync_list')
        if (!balanceUpdateData) {
          break
        }

        const parsed = JSON.parse(balanceUpdateData)
        balanceUpdateList.push({ userId: parsed.id, opId: parsed.opId, balance: parsed.balance })
      }

      if (balanceUpdateList.length === 0) {
        return
      }

      // 去除重複 userId，只保留最大 opId
      const latestMap = new Map()
      for (const { userId, balance, opId } of balanceUpdateList) {
        const existing = latestMap.get(userId)
        if (!existing || opId > existing.opId) {
          latestMap.set(userId, { balance, opId })
        }
      }

      for (const [ userId, { balance, opId }] of latestMap.entries()) {
        const now = new Date() // 現在的時間，更新 `updatedAt`

        await app.model.User.update(
          {
            balance,
            lastOpId: opId,
            updatedAt: now,
          },
          {
            where: {
              id: userId,
              lastOpId: { [app.Sequelize.Op.lt]: opId },
            },
          }
        )

        app.logger.info(`[SyncBalance] ✅ userId ${userId} 餘額 ${balance} 寫入 opId ${opId} 更新時間 updatedAt = ${now}`)
      }
    } catch (error) {
      app.logger.error('[SyncBalance] ❌ 同步失敗:', error)
    }
  }
}

module.exports = SyncBalanceSchedule
