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

    if (!startDate || !endDate) {
      ctx.body = { success: false, message: '請提供查詢的開始與結束日期' }

      return
    }

    console.log('接收到的參數:', { startDate, endDate })

    const result = await ctx.service.transaction.getTransactionHistory(ctx.session.user.id, startDate, endDate)
    ctx.body = result
  }
}

module.exports = TransactionController
