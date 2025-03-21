/* eslint-disable no-undef */
const assert = require('assert')
const { app } = require('egg-mock/bootstrap')

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

    if (loginRes.headers['set-cookie']) {
      cookies.push(...loginRes.headers['set-cookie']) // **確保登入後更新 Session Cookie**
    } else {
      console.warn('⚠️ Login response did not return set-cookie, session might not persist.')
    }

    // 註冊 & 登入後，確保 `user` 存在
    user = await ctx.model.User.findOne({ where: { username: 'test7' } })
  })

  describe('HomeController', () => {
    it('應該成功渲染登入頁面', async () => {
      const response = await agent.get('/login')
      assert.strictEqual(response.status, 200)
    })

    it('應該成功渲染註冊頁面', async () => {
      const response = await agent.get('/register')
      assert.strictEqual(response.status, 200)
    })

    it('應該成功渲染儀表板頁面', async () => {
      const response = await agent.get('/dashboard')
      assert.strictEqual(response.status, 200)
    })
  })

  // 測試存款 API
  describe('POST /api/deposit', () => {
    it('應該拒絕未登入的存款請求', async () => {
      // 重新獲取新的 CSRF Token 並保存 Cookie
      const csrfRes = await agent.get('/api/csrf')
      const tempCsrfToken = csrfRes.body?.csrf
      const tempCookies = [ ...(csrfRes.headers['set-cookie'] || []) ] // ✅ 獲取對應的 Cookie

      // 進行未登入請求，帶入新 Token 和 Cookie
      const response = await agent
        .post('/api/deposit')
        .set('x-csrf-token', tempCsrfToken) // ✅ 重新帶入 CSRF Token
        .set('Cookie', tempCookies) // ✅ 確保攜帶正確的 Session Cookie
        .send({ amount: 500 })

      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '使用者未登入') // ✅ 確保訊息一致
    })
    it('應該成功存款', async () => {
      const response = await agent
        .post('/api/deposit')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 1500 })

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)
      assert.strictEqual(response.body.message, '存款成功')
      assert.strictEqual(response.body.balance, 1500) // 修正預期金額

      // 確保資料庫更新
      const updatedUser = await ctx.model.User.findByPk(user.id)
      assert.strictEqual(Number(updatedUser.balance), 1500)
    })

    it('應該拒絕存款金額小於 0', async () => {
      const response = await agent
        .post('/api/deposit')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: -500 })

      assert.strictEqual(response.status, 400)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '存款金額無效')
    })
  })

  // 測試提款 API
  describe('POST /api/withdraw', () => {
    it('應該拒絕未登入的提款請求', async () => {
      // 重新獲取新的 CSRF Token 並保存 Cookie
      const csrfRes = await agent.get('/api/csrf')
      const tempCsrfToken = csrfRes.body?.csrf
      const tempCookies = [ ...(csrfRes.headers['set-cookie'] || []) ] // ✅ 獲取對應的 Cookie

      // 進行未登入請求，帶入新 Token 和 Cookie
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', tempCsrfToken) // ✅ 重新帶入 CSRF Token
        .set('Cookie', tempCookies) // ✅ 確保攜帶正確的 Session Cookie
        .send({ amount: 500 })

      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '使用者未登入') // ✅ 確保訊息一致
    })
    it('應該成功提款', async () => {
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 500 })

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)
      assert.strictEqual(response.body.message, '提款成功')
      assert.strictEqual(response.body.balance, 1000) // 修正預期金額

      // 確保資料庫更新
      const updatedUser = await ctx.model.User.findByPk(user.id)
      assert.strictEqual(Number(updatedUser.balance), 1000)
    })

    it('應該拒絕提款超過餘額', async () => {
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 2000 })

      assert.strictEqual(response.status, 400)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '餘額不足')
    })
  })

  // 測試交易紀錄查詢 API
  describe('GET /api/transactions', () => {
    it('應該拒絕無效的交易查詢時間', async () => {
      const response = await agent
        .get('/api/transactions')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .query({ startDate: '2025-13-40 00:00:00', endDate: '2025-25-40 23:59:59' }) // ❌ 無效時間

      assert.strictEqual(response.status, 400)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '請提供查詢的開始與結束日期') // ✅ 修正對應的錯誤訊息
    })
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

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)
      assert.strictEqual(response.body.transactions.length, 2)
    })

    it('應該返回快取的交易紀錄', async () => {
      const redisKey = `transaction_history:${user.id}:2025-01-01 00:00:00:2025-12-31 23:59:59`
      const cachedTransactions = [
        { userId: user.id, type: '存款', amount: '500.00', balance: '1500.00' },
        { userId: user.id, type: '提款', amount: '200.00', balance: '1300.00' },
      ]

      // ✅ 強制存入 Redis
      await app.redis.set(redisKey, JSON.stringify(cachedTransactions), 'EX', 3600)

      // **發送 API 請求**
      const response = await agent
        .get('/api/transactions')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .query({ startDate: '2025-01-01 00:00:00', endDate: '2025-12-31 23:59:59' })

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)

      // ✅ **轉換數據格式，確保與返回結果匹配**
      const sanitizedTransactions = response.body.transactions.map(tx => ({
        userId: tx.userId,
        type: tx.type,
        amount: Number(tx.amount),
        balance: Number(tx.balance),
      }))

      const expectedTransactions = cachedTransactions.map(tx => ({
        userId: tx.userId,
        type: tx.type,
        amount: Number(tx.amount),
        balance: Number(tx.balance),
      }))

      // **確保快取返回的交易紀錄正確**
      assert.deepStrictEqual(sanitizedTransactions, expectedTransactions)
    })

    it('應該在沒有快取時返回資料庫的交易紀錄', async () => {
      // 確保 Redis 內沒有快取
      await app.redis.del(`transaction_history:${user.id}:2025-01-01:2025-12-31`)
      await ctx.model.Transaction.destroy({ where: { userId: user.id } }) // 確保刪除該用戶的交易紀錄

      // 先新增交易紀錄到資料庫
      await ctx.model.Transaction.create({ userId: user.id, type: '存款', amount: 500, balance: 1500 })
      await ctx.model.Transaction.create({ userId: user.id, type: '提款', amount: 200, balance: 1300 })

      const response = await agent
        .get('/api/transactions')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .query({ startDate: '2025-01-01 00:00:00', endDate: '2025-12-31 23:59:59' })

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)

      // 確保返回的交易數據與資料庫匹配
      assert.strictEqual(response.body.transactions.length, 2)
    })
  })

  // 補充 home.js 測試
  describe('GET /', () => {
    it('應該成功渲染首頁', async () => {
      const response = await agent.get('/')
      assert.strictEqual(response.status, 302)
      assert.strictEqual(response.headers.location, '/login')
    })
  })

  describe('GET /api/check-login', () => {
    it('應該回傳尚未登入', async () => {
      // **確保登出，避免 session 影響**
      const logoutResponse = await agent
        .post('/api/logout')
        .set('x-csrf-token', csrfToken) // ✅ 確保帶入 CSRF Token
        .set('Cookie', cookies) // ✅ 確保 Session Cookie 一起帶入
        .send()

      assert.strictEqual(logoutResponse.status, 200) // ✅ 確保 API 成功返回
      assert.strictEqual(logoutResponse.body.success, true) // ✅ 確保登出成功

      // **重置 cookies，避免攜帶舊 session**
      cookies = []

      // **重新獲取新的 CSRF Token 並保存 Cookie**
      const csrfRes = await agent.get('/api/csrf')
      const tempCsrfToken = csrfRes.body?.csrf
      const tempCookies = [ ...(csrfRes.headers['set-cookie'] || []) ] // ✅ 確保新的 Cookie

      // **發送未登入的 check-login API 請求**
      const response = await agent
        .get('/api/check-login')
        .set('x-csrf-token', tempCsrfToken) // ✅ 重新帶入 CSRF Token
        .set('Cookie', tempCookies) // ✅ 確保攜帶新的 Session Cookie

      assert.strictEqual(response.status, 200) // 確保 API 正常返回
      assert.strictEqual(response.body.success, false) // 確保回傳未登入
      assert.strictEqual(response.body.message, '尚未登入') // 確保訊息一致
    })

    it('應該返回登入狀態', async () => {
      const response = await agent
        .get('/api/check-login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)
    })
  })

  describe('GET /api/balance', () => {
    it('應該拒絕未登入用戶的餘額請求', async () => {
      const response = await agent
        .get('/api/balance')
        .set('x-csrf-token', csrfToken)

      assert.strictEqual(response.status, 200) // 確保 API 正常返回
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '尚未登入，請先登入')
    })

    it('應該成功獲取餘額', async () => {
      const response = await agent
        .get('/api/balance')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)
      assert.strictEqual(typeof response.body.balance, 'number') // 確保 `balance` 是數字
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

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)
      assert.strictEqual(response.body.balance, balance) // 確保快取值正確
    })

    it('應該在沒有快取時查詢資料庫並存入 Redis', async () => {
      const userId = user.id

      // **先清除 Redis，確保無快取**
      await app.redis.del(`user_balance:${userId}`)

      // **發送 API 請求**
      const response = await agent
        .get('/api/balance')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)

      // **檢查 Redis 是否存入新快取**
      const cachedBalance = await app.redis.get(`user_balance:${userId}`)
      assert.strictEqual(Number(cachedBalance), response.body.balance)
    })


  })

  describe('POST /api/logout', () => {
    it('應該成功登出', async () => {
      const response = await agent
        .post('/api/logout')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send()

      assert.strictEqual(response.status, 200)
      assert.strictEqual(response.body.success, true)
      assert.strictEqual(response.body.message, '已登出')
    })
  })

  // 補充 user.js 測試
  describe('POST /api/login', () => {
    it('應該拒絕不存在的帳號登入', async () => {
      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'non_existing_user', password: '12345' })

      assert.strictEqual(response.status, 401)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '帳號不存在')
    })
    it('應該拒絕錯誤的帳號', async () => {
      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'wrong_user', password: 'wrong_password' })

      assert.strictEqual(response.status, 401)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '帳號不存在')
    })
    it('應該拒絕錯誤的密碼', async () => {
      await ctx.service.user.register('test_user', 'correct_password') // 先註冊用戶

      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'test_user', password: 'wrong_password' })

      assert.strictEqual(response.status, 401)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '密碼錯誤')
    })
  })

  describe('POST /api/register', () => {
    it('應該拒絕缺少密碼的註冊請求', async () => {
      const response = await agent
        .post('/api/register')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'new_user' }) // 缺少密碼

      assert.strictEqual(response.status, 400)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '用戶名和密碼不能為空')
    })
  })

  describe('POST /api/login', () => {
    it('應該拒絕缺少密碼的登入請求', async () => {
      const response = await agent
        .post('/api/login')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .send({ username: 'new_user' }) // 缺少密碼

      assert.strictEqual(response.status, 400)
      assert.strictEqual(response.body.success, false)
      assert.strictEqual(response.body.message, '用戶名和密碼不能為空')
    })
  })
})
