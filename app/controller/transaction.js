const { Controller } = require('egg')

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

    if (startDate === ':00' || endDate === ':00') {
      response = { success: false, message: '請提供查詢的開始與結束日期' }
    } else {
      response = await ctx.service.transaction.getTransactionHistory(ctx.session.user.id, startDate, endDate)
    }
    ctx.body = response
  }
}

module.exports = TransactionController
