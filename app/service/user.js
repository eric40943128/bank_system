const { Service } = require('egg')

class UserService extends Service {
  async register(username, password) {
    const existingUser = await this.ctx.model.User.findOne({ where: { username } })
    let response

    if (existingUser) {
      response = { success: false, message: '帳號已被註冊過' }
    } else {
      await this.ctx.model.User.create({ username, password, balance: 0 })
      response = { success: true, message: '註冊成功' }
    }

    return response
  }

  async login(username, password) {
    const user = await this.ctx.model.User.findOne({ where: { username } })
    let response

    if (!user) {
      response = { success: false, message: '帳號不存在' }
    } else if (user.password !== password) {
      response = { success: false, message: '密碼錯誤' }
    } else {
      this.ctx.session.user = { id: user.id, username: user.username }
      response = { success: true, message: '登入成功', user: { id: user.id, username: user.username } }
    }

    return response
  }

  async logout() {
    const { ctx } = this
    this.ctx.session = null // 清除 Session
    ctx.cookies.set('EGG_SESS', null, { maxAge: -1, httpOnly: true, overwrite: true }) // 強制刪除 Cookie

    ctx.body = { success: true, message: '已登出' }
  }

  async getBalance(userId) {
    const { ctx, app } = this
    const redisKey = `user_balance:${userId}`
    let response
    const user = await ctx.model.User.findByPk(userId)

    let balance = await app.redis.get(redisKey)
    if (balance) {
      console.log('從 Redis 快取取得餘額', balance)
      response = { success: true, balance: parseFloat(balance) }
    } else if (!user) {
      response = { success: false, message: '使用者不存在' }
    } else {
      balance = user.balance
      await app.redis.set(redisKey, balance, 'EX', 60 * 60)
      response = { success: true, balance: user.balance }
    }

    return response
  }

  async checkLoginStatus() {
    const sessionUser = this.ctx.session.user
    let response

    if (sessionUser) {
      response = { success: true, message: '已登入', user: sessionUser }
    } else {
      response = { success: false, message: '尚未登入' }
    }

    return response
  }

}

module.exports = UserService
