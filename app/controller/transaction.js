const { Controller } = require('egg')
const moment = require('moment')

class TransactionController extends Controller {
  async deposit() {
    const { ctx } = this
    const { amount } = ctx.request.body
    const result = await ctx.service.transaction.deposit(ctx.session.user.id, amount)

    ctx.body = result
  }

  async withdraw() {
    const { ctx } = this
    const { amount } = ctx.request.body
    const result = await ctx.service.transaction.withdraw(ctx.session.user.id, amount)

    ctx.body = result
  }

  async getTransactionHistory() {
    const { ctx } = this
    const { startDate, endDate } = ctx.query
    let response

    const isValidStartDate = moment(startDate, 'YYYY-MM-DD HH:mm:ss', true).isValid()
    const isValidEndDate = moment(endDate, 'YYYY-MM-DD HH:mm:ss', true).isValid()

    if (!isValidStartDate || !isValidEndDate) {
      response = { success: false, message: '請提供查詢的開始與結束日期' }
    } else {
      response = await ctx.service.transaction.getTransactionHistory(ctx.session.user.id, startDate, endDate)
    }

    ctx.body = response
  }
}

module.exports = TransactionController
