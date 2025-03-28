const { Service } = require('egg')

class UserService extends Service {
  async register(username, password) {
    let response
    const existingUser = await this.findUserByUsername(username)

    if (existingUser) {
      response = { success: false, message: '帳號已被註冊過' }
    } else {
      await this.createUser(username, password)
      response = { success: true, message: '註冊成功' }
    }

    return response
  }

  async login(username, password) {
    let response
    const user = await this.findUserByUsername(username)

    if (!user) {
      response = { success: false, message: '帳號不存在' }
    } else if (user.password !== password) {
      response = { success: false, message: '密碼錯誤' }
    } else {
      this.setUserSession(user)
      response = { success: true, message: '登入成功', user: { id: user.id, username: user.username } }
    }

    return response
  }

  async logout() {
    this.clearUserSession()

    return { success: true, message: '已登出' }
  }

  async getBalance(userId) {
    let response

    let balance = await this.getUserBalanceFromCache(userId)
    if (balance !== null) {
      balance = Number(balance)
      response = { success: true, balance: (balance / 100).toFixed(2) }
    } else {
      const user = await this.getUserInformationFromDB(userId)
      this.cacheUserBalance(userId, user.balance, user.lastOpId)
      response = { success: true, balance: Number(user.balance) }
    }

    return response
  }

  async checkLoginStatus() {
    let response
    const sessionUser = this.ctx.session.user

    if (sessionUser) {
      response = { success: true, message: '已登入', user: sessionUser }
    } else {
      response = { success: false, message: '尚未登入' }
    }

    return response
  }

  // 透過 username 查找用戶
  async findUserByUsername(username) {
    return await this.ctx.model.User.findOne({ where: { username } })
  }

  // 創建新用戶
  async createUser(username, password) {
    await this.ctx.model.User.create({ username, password, balance: 0 })
  }

  // 設定使用者 Session
  setUserSession(user) {
    this.ctx.session.user = { id: user.id, username: user.username }
  }

  // 清除使用者 Session
  clearUserSession() {
    this.ctx.session = null
    this.ctx.cookies.set('EGG_SESS', null, { maxAge: -1, httpOnly: true, overwrite: true })
  }

  // 從 Redis Hash 結構獲取用戶餘額
  async getUserBalanceFromCache(userId) {
    return await this.app.redis.hget(`user_key:${userId}`, 'balance_cents')
  }

  // 從資料庫獲取用戶資訊
  async getUserInformationFromDB(userId) {
    return await this.ctx.model.User.findByPk(userId)
  }

  // 快取用戶餘額至 Redis Hash 結構
  async cacheUserBalance(userId, balance, opId) {
    const redis = this.app.redis
    balance = Number(balance * 100)
    await redis
      .multi()
      .hset(`user_key:${userId}`, 'balance_cents', balance)
      .hset(`user_key:${userId}`, 'opId', opId)
      .expire(`user_key:${userId}`, 60 * 60)
      .exec()
  }
}

module.exports = UserService
