'use strict'

const Queue = require('bull')

const updateUserBalanceQueue = new Queue('update-user-balance-queue', {
  redis: { host: '127.0.0.1', port: 6379 },
})

module.exports = {
  updateUserBalanceQueue,
}
