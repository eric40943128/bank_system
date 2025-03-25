const assert = require('assert')
const { app } = require('egg-mock/bootstrap')

describe('UserService', () => {
  let ctx

  beforeEach(() => {
    ctx = app.mockContext()
  })

  describe('register()', () => {
    it('應該返回錯誤：用戶已存在', async () => {
      await ctx.service.user.register('existing_user', '12345')
      const response = await ctx.service.user.register('existing_user', '12345')

      const expected = { success: false, message: '帳號已被註冊過' }
      assert.deepStrictEqual(response, expected)
    })

    it('應該成功註冊新用戶', async () => {
      const response = await ctx.service.user.register('new_user', 'password123')
      const expected = { success: true, message: '註冊成功' }
      assert.deepStrictEqual(response, expected)
    })
  })

  describe('login()', () => {
    it('應該返回錯誤：帳號不存在', async () => {
      const response = await ctx.service.user.login('unknown_user', 'password')
      const expected = { success: false, message: '帳號不存在' }
      assert.deepStrictEqual(response, expected)
    })

    it('應該返回錯誤：密碼錯誤', async () => {
      await ctx.service.user.register('user1', 'correct_pw')
      const response = await ctx.service.user.login('user1', 'wrong_pw')
      const expected = { success: false, message: '密碼錯誤' }
      assert.deepStrictEqual(response, expected)
    })

    it('應該成功登入', async () => {
      await ctx.service.user.register('user2', 'pw123')
      const response = await ctx.service.user.login('user2', 'pw123')
      const expected = {
        success: true,
        message: '登入成功',
        user: { id: response.user.id, username: 'user2' },
      }
      assert.deepStrictEqual(response, expected)
    })
  })

  describe('logout()', () => {
    it('應該成功登出', async () => {
      ctx.session.user = { id: 1, username: 'logout_user' }
      const response = await ctx.service.user.logout()
      assert.deepStrictEqual(response, { success: true, message: '已登出' })
    })
  })

  describe('getBalance()', () => {
    it('應該回傳快取的餘額', async () => {
      const testUser = await ctx.model.User.create({ username: 'cache_user', password: 'pw', balance: 2000 })
      await app.redis.set(`user_balance:${testUser.id}`, 2000)

      const response = await ctx.service.user.getBalance(testUser.id)
      const expected = { success: true, balance: 2000 }
      assert.deepStrictEqual(response, expected)
    })

    it('應該從資料庫查詢餘額', async () => {
      const testUser = await ctx.model.User.create({ username: 'db_user', password: 'pw', balance: 1500 })
      await app.redis.del(`user_balance:${testUser.id}`)

      const response = await ctx.service.user.getBalance(testUser.id)
      const expected = { success: true, balance: 1500 }
      assert.deepStrictEqual(response, expected)
    })
  })

  describe('checkLoginStatus()', () => {
    it('應該回傳尚未登入狀態', async () => {
      ctx.session = {}
      const response = await ctx.service.user.checkLoginStatus()
      const expected = { success: false, message: '尚未登入' }
      assert.deepStrictEqual(response, expected)
    })

    it('應該回傳已登入狀態', async () => {
      ctx.session.user = { id: 1, username: 'session_user' }
      const response = await ctx.service.user.checkLoginStatus()
      const expected = {
        success: true,
        message: '已登入',
        user: { id: 1, username: 'session_user' },
      }
      assert.deepStrictEqual(response, expected)
    })
  })

  describe('findUserByUsername()', () => {
    it('應該透過使用者名稱查詢用戶', async () => {
      await ctx.model.User.create({ username: 'findme', password: 'pw' })
      const user = await ctx.service.user.findUserByUsername('findme')
      const userData = {
        id: user.id,
        username: user.username,
        password: user.password,
        balance: Number(user.balance), // 確保型別一致
      }
      const expected = { id: user.id, username: 'findme', password: 'pw', balance: 0 }
      assert.deepStrictEqual(userData, expected)
    })
  })

  describe('createUser()', () => {
    it('應該建立新使用者至資料庫', async () => {
      await ctx.service.user.createUser('created_user', 'pw321')
      const createdUser = await ctx.model.User.findOne({ where: { username: 'created_user' } })

      const userData = {
        username: createdUser.username,
        password: createdUser.password,
        balance: Number(createdUser.balance),
      }

      const expected = {
        username: 'created_user',
        password: 'pw321',
        balance: 0,
      }

      assert.deepStrictEqual(userData, expected)
    })
  })

  describe('setUserSession()', () => {
    it('應該設定使用者 session', () => {
      const fakeUser = { id: 100, username: 'test_session' }
      ctx.service.user.setUserSession(fakeUser)
      assert.deepStrictEqual(ctx.session.user, { id: 100, username: 'test_session' })
    })
  })

  describe('clearUserSession()', () => {
    it('應該清除使用者 session', () => {
      ctx.session.user = { id: 1, username: 'test' }
      ctx.service.user.clearUserSession()
      assert.deepStrictEqual(ctx.session, null)
    })
  })

  describe('getUserBalanceFromCache()', () => {
    it('應該從 Redis 正確讀取用戶餘額', async () => {
      await app.redis.set('user_balance:101', 800)
      const balance = await ctx.service.user.getUserBalanceFromCache(101)
      assert.deepStrictEqual(balance, '800')
    })
  })

  describe('getUserInformationFromDB()', () => {
    it('應該從資料庫查詢用戶資訊', async () => {
      const user = await ctx.model.User.create({ username: 'dbuser', password: 'pw' })
      const fetched = await ctx.service.user.getUserInformationFromDB(user.id)

      const userData = {
        id: fetched.id,
        username: fetched.username,
        password: fetched.password,
        balance: Number(fetched.balance),
      }

      const expected = {
        id: user.id,
        username: 'dbuser',
        password: 'pw',
        balance: 0,
      }

      assert.deepStrictEqual(userData, expected)
    })
  })

  describe('cacheUserBalance()', () => {
    it('應該將使用者餘額寫入 Redis 快取', async () => {
      await ctx.service.user.cacheUserBalance(999, 9999)
      const cached = await app.redis.get('user_balance:999')
      assert.deepStrictEqual(cached, '9999')
    })
  })
})
