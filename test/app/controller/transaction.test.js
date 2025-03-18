const { app } = require('egg-mock/bootstrap')
const { expect } = require('@jest/globals')

describe('TransactionController', () => {
  let ctx,
    user,
    agent,
    csrfToken,
    cookies

  beforeEach(async () => {
    await app.ready() // 確保測試環境啟動
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

    if (Array.isArray(loginRes.headers['set-cookie'])) {
      cookies.push(...loginRes.headers['set-cookie'])
    } else {
      console.warn('⚠️ Login response did not return set-cookie, session might not persist.')
    }

    // 註冊 & 登入後，確保 `user` 存在
    user = await ctx.model.User.findOne({ where: { username: 'test7' } })

    if (!user) {
      throw new Error('❌ 無法找到 `test7` 用戶，請確認註冊 API 是否成功執行')
    }
  })

  // 測試存款 API
  describe('POST /api/deposit', () => {
    it('應該成功存款', async () => {
      const response = await agent
        .post('/api/deposit')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 1500 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('存款成功')
      expect(response.body.balance).toBe(1500) // 修正預期金額

      // 確保資料庫更新
      const updatedUser = await ctx.model.User.findByPk(user.id)
      expect(Number(updatedUser.balance)).toBe(1500)
    })

    it('應該拒絕存款金額小於 0', async () => {
      const response = await agent
        .post('/api/deposit')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: -500 })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('存款金額無效')
    })
  })

  // 測試提款 API
  describe('POST /api/withdraw', () => {
    it('應該成功提款', async () => {
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 500 })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.message).toBe('提款成功')
      expect(response.body.balance).toBe(1000) // 修正預期金額

      // 確保資料庫更新
      const updatedUser = await ctx.model.User.findByPk(user.id)
      expect(Number(updatedUser.balance)).toBe(1000)
    })

    it('應該拒絕提款超過餘額', async () => {
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 2000 })

      expect(response.status).toBe(400)
      expect(response.body.success).toBe(false)
      expect(response.body.message).toBe('餘額不足')
    })
  })

  // 測試交易紀錄查詢 API
  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      await ctx.model.Transaction.destroy({ where: { userId: user.id } })
      // 模擬交易紀錄
      await ctx.model.Transaction.create({ userId: user.id, type: '存款', amount: 500, balance: 1500 })
      await ctx.model.Transaction.create({ userId: user.id, type: '提款', amount: 200, balance: 1300 })
    })

    it('應該回傳交易紀錄', async () => {
      const response = await agent
        .get('/api/transactions')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .query({ startDate: '2025-01-01 00:00:00', endDate: '2025-12-31 23:59:59' })

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.transactions.length).toBe(2)
    })
  })
})
