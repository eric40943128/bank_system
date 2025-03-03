const { Service } = require('egg')

class UserService extends Service {
  async register(username, password) {
    const existingUser = await this.ctx.model.User.findOne({ where: { username } })

    if (existingUser) {
      return { success: false, message: '帳號已被註冊過' }
    }

    await this.ctx.model.User.create({ username, password, balance: 0 })

    return { success: true, message: '註冊成功' }
  }

  async login(username, password) {
    const user = await this.ctx.model.User.findOne({ where: { username } })

    if (!user) {
      return { success: false, message: '帳號不存在' }
    }

    if (user.password !== password) {
      return { success: false, message: '密碼錯誤' }
    }

    this.ctx.session.user = { id: user.id, username: user.username }

    return { success: true, message: '登入成功', user: { id: user.id, username: user.username } }
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

    let balance = await app.redis.get(redisKey)
    if (balance) {
      console.log('從 Redis 快取取得餘額', balance)

      return { success: true, balance: parseFloat(balance) }
    }

    const user = await ctx.model.User.findByPk(userId)
    if (!user) {
      return { success: false, message: '使用者不存在' }
    }

    balance = user.balance
    await app.redis.set(redisKey, balance, 'EX', 60 * 60)

    return { success: true, balance: user.balance }
  }

  async checkLoginStatus() {
    const sessionUser = this.ctx.session.user

    if (sessionUser) {
      return { success: true, message: '已登入', user: sessionUser }
    }

    return { success: false, message: '尚未登入' }
  }

}

module.exports = UserService
