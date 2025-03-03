'use strict'

const { Controller } = require('egg')

class UserController extends Controller {

  /**
   * 用戶註冊
   */
  async register() {
    const { ctx } = this
    const { username, password } = ctx.request.body

    if (!username || !password) {
      ctx.body = { success: false, message: '用戶名和密碼不能為空' }

      return
    }

    const result = await ctx.service.user.register(username, password)
    ctx.body = result
  }

  /**
   * 用戶登入
   */
  async login() {
    const { ctx } = this
    const { username, password } = ctx.request.body

    if (!username || !password) {
      ctx.body = { success: false, message: '用戶名和密碼不能為空' }

      return
    }

    const result = await ctx.service.user.login(username, password)
    ctx.body = result
  }

  /**
   * 用戶登出
   */
  async logout() {
    const { ctx } = this

    // 呼叫 Service 處理登出邏輯
    const result = await ctx.service.user.logout()
    ctx.body = result
  }

  /**
   * 確認是否已登入
   */
  async checkLoginStatus() {
    const { ctx } = this
    const result = await ctx.service.user.checkLoginStatus()
    ctx.body = result
  }

  /**
   * 查詢用戶餘額 (getBalance)
   */
  async getBalance() {
    const { ctx } = this

    if (!ctx.session || !ctx.session.user) {
      ctx.body = { success: false, message: '尚未登入，請先登入' }

      return
    }
    const result = await ctx.service.user.getBalance(ctx.session.user.id)
    ctx.body = result
  }
}

module.exports = UserController
