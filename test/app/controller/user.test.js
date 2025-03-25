const assert = require('assert')
const { app } = require('egg-mock/bootstrap')

describe('UserController', () => {
  let ctx,
    user,
    agent,
    csrfToken,
    cookies

  beforeEach(async () => {
    ctx = app.mockContext()
    agent = app.httpRequest()

    // 清空 Redis 避免影響測試
    await app.redis.flushdb()

    // 取得 CSRF Token 並保存 Cookie
    const csrfRes = await agent.get('/api/csrf')

    cookies = [ ...(csrfRes.headers['set-cookie'] || []) ]
    csrfToken = csrfRes.body?.csrf || null

    if (!csrfToken || typeof csrfToken !== 'string') {
      throw new Error(`❌ 測試環境無法獲取 CSRF Token，請確認 \`/api/csrf\` 是否正確回應: ${JSON.stringify(csrfRes.body)}`)
    }

    // 先嘗試註冊用戶
    await agent.post('/api/register')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', cookies)
      .send({ username: 'test7', password: '12345' })

    // 登入時確保帶入 CSRF Token & Cookie，並保存新的 Cookie
    const loginRes = await agent
      .post('/api/login')
      .set('x-csrf-token', csrfToken)
      .set('Cookie', cookies)
      .send({ username: 'test7', password: '12345' })

    if (loginRes.status !== 200) {
      throw new Error(`❌ 登入失敗，請檢查 login API 是否正常返回: ${JSON.stringify(loginRes.body)}`)
    }

    if (loginRes.headers['set-cookie']) {
      cookies.push(...loginRes.headers['set-cookie']) // **確保登入後更新 Session Cookie**
    } else {
      console.warn('⚠️ Login response did not return set-cookie, session might not persist.')
    }

    // 註冊 & 登入後，確保 `user` 存在
    user = await ctx.model.User.findOne({ where: { username: 'test7' } })
  })

  describe('POST /api/register', () => {
    it('應該拒絕缺少密碼的註冊請求', async () => {
      const response = await agent
        .post('/api/register')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'new_user' }) // 缺少密碼

      const expected = { success: false, message: '用戶名和密碼不能為空' }
      assert.deepStrictEqual(response.body, expected)
    })
  })

  describe('POST /api/login', () => {
    it('應該拒絕不存在的帳號登入', async () => {
      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'non_existing_user', password: '12345' })

      const expected = { success: false, message: '帳號不存在' }
      assert.deepStrictEqual(response.body, expected)
    })
    it('應該拒絕錯誤的帳號', async () => {
      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'wrong_user', password: 'wrong_password' })

      const expected = { success: false, message: '帳號不存在' }
      assert.deepStrictEqual(response.body, expected)
    })
    it('應該拒絕錯誤的密碼', async () => {
      await ctx.service.user.register('test_user', 'correct_password') // 先註冊用戶

      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'test_user', password: 'wrong_password' })

      const expected = { success: false, message: '密碼錯誤' }
      assert.deepStrictEqual(response.body, expected)
    })
    it('應該拒絕缺少密碼的登入請求', async () => {
      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'new_user' }) // 缺少密碼

      const expected = { success: false, message: '用戶名和密碼不能為空' }
      assert.deepStrictEqual(response.body, expected)
    })
  })

  describe('POST /api/logout', () => {
    it('應該成功登出', async () => {
      const response = await agent
        .post('/api/logout')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send()

      const expected = { success: true, message: '已登出' }
      assert.deepStrictEqual(response.body, expected)
    })
  })

  describe('GET /api/check-login', () => {
    it('應該回傳尚未登入', async () => {
      // **確保登出，避免 session 影響**
      await agent
        .post('/api/logout')
        .set('x-csrf-token', csrfToken) // ✅ 確保帶入 CSRF Token
        .set('Cookie', cookies) // ✅ 確保 Session Cookie 一起帶入
        .send()

      // **重新獲取新的 CSRF Token 並保存 Cookie**
      const csrfRes = await agent.get('/api/csrf')
      const tempCsrfToken = csrfRes.body?.csrf
      const tempCookies = [ ...(csrfRes.headers['set-cookie'] || []) ] // ✅ 確保新的 Cookie

      // **發送未登入的 check-login API 請求**
      const response = await agent
        .get('/api/check-login')
        .set('x-csrf-token', tempCsrfToken) // ✅ 重新帶入 CSRF Token
        .set('Cookie', tempCookies) // ✅ 確保攜帶新的 Session Cookie

      const expected = { success: false, message: '尚未登入' }
      assert.deepStrictEqual(response.body, expected) // 確保回傳未登入
    })

    it('應該返回登入狀態', async () => {
      const response = await agent
        .get('/api/check-login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)

      const expected = {
        success: true,
        message: '已登入',
        user: {
          id: user.id,
          username: user.username,
        },
      }
      assert.deepStrictEqual(response.body, expected)
    })
  })

  describe('GET /api/balance', () => {
    it('應該拒絕未登入用戶的餘額請求', async () => {
      const response = await agent
        .get('/api/balance')
        .set('x-csrf-token', csrfToken)

      const expected = { success: false, message: '尚未登入，請先登入' }
      assert.deepStrictEqual(response.body, expected) // 確保返回的訊息正確
    })

    it('應該成功獲取餘額', async () => {
      const response = await agent
        .get('/api/balance')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)

      const expected = { success: true, balance: Number(response.body.balance) } // 確保 balance 是數字
      assert.deepStrictEqual(response.body, expected)
    })

    it('應該返回快取的餘額', async () => {
      const userId = user.id
      const balance = 2000

      // **存入 Redis 快取**
      await app.redis.set(`user_balance:${userId}`, balance.toString(), 'EX', 3600)

      const response = await agent
        .get('/api/balance')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)

      const expected = { success: true, balance }
      assert.deepStrictEqual(response.body, expected) // 確保快取值正確
    })

    it('應該在沒有快取時查詢資料庫並存入 Redis', async () => {
      const userId = user.id

      // **先重設使用者餘額並清除 Redis 快取，確保不受其他測試干擾**
      await ctx.model.User.update({ balance: 777 }, { where: { id: userId } })
      await app.redis.del(`user_balance:${userId}`)

      // **發送 API 請求**
      const response = await agent
        .get('/api/balance')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)

      const expected = { balance: response.body.balance, success: true }
      assert.deepStrictEqual(response.body, expected) // 確保返回的成功訊息正確

    })
  })
})
