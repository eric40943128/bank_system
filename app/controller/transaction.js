const { Controller } = require('egg')
const moment = require('moment')

class TransactionController extends Controller {
  async deposit() {
    const { ctx } = this
    const { amount } = ctx.request.body
    const sessionUser = ctx.session.user
    let response

    if (!sessionUser) {
      response = { success: false, message: '使用者未登入' }
    } else {
      const depositAmount = Number(amount)
      const user = await ctx.model.User.findByPk(sessionUser.id)

      const validationError = ctx.service.transaction.validateAmount(user, depositAmount, 'deposit')
      if (validationError) {
        response = validationError
      } else {
        response = await ctx.service.transaction.deposit(user, depositAmount)
      }
    }

    ctx.body = response
  }

  async withdraw() {
    const { ctx } = this
    const { amount } = ctx.request.body
    const sessionUser = ctx.session.user
    let response

    if (!sessionUser) {
      response = { success: false, message: '使用者未登入' }
    } else {
      const withdrawAmount = Number(amount)
      const user = await ctx.model.User.findByPk(sessionUser.id)

      const validationError = ctx.service.transaction.validateAmount(user, withdrawAmount, 'withdraw')
      if (validationError) {
        response = validationError
      } else {
        response = await ctx.service.transaction.withdraw(user, withdrawAmount)
      }
    }

    ctx.body = response
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
