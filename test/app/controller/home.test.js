const assert = require('assert')
const { app } = require('egg-mock/bootstrap')

describe('HomeController', () => {
  let agent

  beforeEach(async () => {
    agent = app.httpRequest()

    // 清空 Redis 避免影響測試
    await app.redis.flushdb()
  })


  it('應該成功渲染首頁', async () => {
    const response = await agent.get('/')
    const expected = { status: 302, headers: { location: '/login' } }
    assert.deepStrictEqual({ status: response.status, headers: { location: response.headers.location } }, expected)
  })

  it('應該成功渲染登入頁面', async () => {
    const response = await agent.get('/login')
    const expected = { status: 200 }
    assert.deepStrictEqual(response.status, expected.status)
  })

  it('應該成功渲染註冊頁面', async () => {
    const response = await agent.get('/register')
    const expected = { status: 200 }
    assert.deepStrictEqual(response.status, expected.status)
  })

  it('應該成功渲染儀表板頁面', async () => {
    const response = await agent.get('/dashboard')
    const expected = { status: 200 }
    assert.deepStrictEqual(response.status, expected.status)
  })
})
