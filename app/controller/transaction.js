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
      const validationError = this.validateDepositAmount(depositAmount)
      if (validationError) {
        response = validationError
      } else {
        const user = await ctx.model.User.findByPk(sessionUser.id)
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
      const validationError = this.validateWithdrawAmount(user, withdrawAmount)
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

  // 驗證存款金額
  validateDepositAmount(amount) {
    let response = null
    if (isNaN(amount) || amount <= 0) {
      response = { success: false, message: '存款金額無效' }
    }

    return response
  }

  // 驗證提款金額
  validateWithdrawAmount(user, withdrawAmount) {
    let response = null
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      response = { success: false, message: '提款金額錯誤' }
    } else if (user.balance < withdrawAmount) {
      response = { success: false, message: '餘額不足' }
    }

    return response
  }
}

module.exports = TransactionController
