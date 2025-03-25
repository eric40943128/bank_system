const assert = require('assert')
const { app } = require('egg-mock/bootstrap')

describe('TransactionController', () => {
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

  // 測試存款 API
  describe('POST /api/deposit', () => {
    it('應該拒絕未帶入 CSRF Token 的請求', async () => {
      const response = await agent
        .post('/api/deposit')
        .set('Cookie', cookies) // 只帶入 Session Cookie，未帶入 CSRF Token
        .send({ amount: 500 })

      assert.deepStrictEqual(response.status, 403) // 預期禁止請求
    })

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

      const expected = { success: false, message: '使用者未登入' }
      assert.deepStrictEqual(response.body, expected) // ✅ 確保訊息一致
    })
    it('應該成功存款', async () => {
      const response = await agent
        .post('/api/deposit')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 1500 })

      const expected = { success: true, message: '存款成功', balance: 1500 }
      assert.deepStrictEqual(response.body, expected) // 確保返回的訊息和餘額正確

    })

    it('應該拒絕存款金額小於 0', async () => {
      const response = await agent
        .post('/api/deposit')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: -500 })

      const expected = { success: false, message: '存款金額無效' }
      assert.deepStrictEqual(response.body, expected)
    })
  })

  // 測試提款 API
  describe('POST /api/withdraw', () => {
    it('應該拒絕未帶入 CSRF Token 的請求', async () => {
      const response = await agent
        .post('/api/withdraw')
        .set('Cookie', cookies) // 未帶入 CSRF Token
        .send({ amount: 500 })

      assert.deepStrictEqual(response.status, 403)
    })

    it('應該拒絕未登入的提款請求', async () => {
      // 重新獲取新的 CSRF Token 並保存 Cookie
      const csrfRes = await agent.get('/api/csrf')
      const tempCsrfToken = csrfRes.body?.csrf
      const tempCookies = [ ...(csrfRes.headers['set-cookie'] || []) ] // ✅ 獲取對應的 Cookie

      // 進行未登入請求，帶入新 Token 和 Cookie
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', tempCsrfToken) // 重新帶入 CSRF Token
        .set('Cookie', tempCookies) // 確保攜帶正確的 Session Cookie
        .send({ amount: 500 })

      const expected = { success: false, message: '使用者未登入' }
      assert.deepStrictEqual(response.body, expected)
    })
    it('應該成功提款', async () => {
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 500 })

      const expected = { success: true, message: '提款成功', balance: 1000 }
      assert.deepStrictEqual(response.body, expected) // 確保返回的訊息和餘額正確

    })

    it('應該拒絕提款超過餘額', async () => {
      const response = await agent
        .post('/api/withdraw')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .send({ amount: 2000 })

      const expected = { success: false, message: '餘額不足' }
      assert.deepStrictEqual(response.body, expected)
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

      const expected = { success: false, message: '請提供查詢的開始與結束日期' }
      assert.deepStrictEqual(response.body, expected) // ✅ 修正對應的錯誤訊息
    })

    it('應該回傳交易紀錄（無快取）', async () => {
      // 移除原有交易資料，並建立新的交易紀錄
      await ctx.model.Transaction.destroy({ where: { userId: user.id } })
      await ctx.model.Transaction.create({ userId: user.id, type: '存款', amount: 500, balance: 1500 })
      await ctx.model.Transaction.create({ userId: user.id, type: '提款', amount: 200, balance: 1300 })

      const response = await agent
        .get('/api/transactions')
        .set('x-csrf-token', csrfToken) // 確保 CSRF Token 帶入
        .set('Cookie', cookies) // 確保 Session Cookie 帶入
        .query({ startDate: '2025-01-01 00:00:00', endDate: '2025-12-31 23:59:59' })

      const transactionsData = {
        success: response.body.success,
        transactions: response.body.transactions.map(transactionRecord => ({
          userId: transactionRecord.userId,
          type: transactionRecord.type,
          amount: Number(transactionRecord.amount),
          balance: Number(transactionRecord.balance),
        })),
      }

      const expected = {
        success: true,
        transactions: [
          { userId: user.id, type: '存款', amount: 500, balance: 1500 },
          { userId: user.id, type: '提款', amount: 200, balance: 1300 },
        ],
      }

      assert.deepStrictEqual(transactionsData, expected) // 確保返回的交易紀錄正確
    })

    it('應該返回快取的交易紀錄', async () => {
      const redisKey = `transaction_history:${user.id}:2025-01-01 00:00:00:2025-12-31 23:59:59`
      const cachedTransactions = [
        { userId: user.id, type: '存款', amount: '500.00', balance: '1500.00' },
        { userId: user.id, type: '提款', amount: '200.00', balance: '1300.00' },
      ]

      // 強制存入 Redis
      await app.redis.set(redisKey, JSON.stringify(cachedTransactions), 'EX', 3600)

      // **發送 API 請求**
      const response = await agent
        .get('/api/transactions')
        .set('x-csrf-token', csrfToken)
        .set('Cookie', cookies)
        .query({ startDate: '2025-01-01 00:00:00', endDate: '2025-12-31 23:59:59' })

      const transactionsData = {
        success: response.body.success,
        transactions: response.body.transactions.map(transactionRecord => ({
          userId: transactionRecord.userId,
          type: transactionRecord.type,
          amount: Number(transactionRecord.amount),
          balance: Number(transactionRecord.balance),
        })),
      }

      const expected = { success: true, transactions: cachedTransactions.map(transactionRecord => ({
        userId: transactionRecord.userId,
        type: transactionRecord.type,
        amount: Number(transactionRecord.amount),
        balance: Number(transactionRecord.balance),
      })) }

      assert.deepStrictEqual(transactionsData, expected) // 確保快取返回的交易紀錄正確
    })
  })
})
