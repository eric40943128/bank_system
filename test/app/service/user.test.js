const assert = require('assert')
const { app } = require('egg-mock/bootstrap')

describe('UserService', () => {
  let ctx

  beforeEach(() => {
    ctx = app.mockContext()
  })

  it('應該返回錯誤：用戶已存在', async () => {
    await ctx.service.user.register('existing_user', '12345')
    const response = await ctx.service.user.register('existing_user', '12345')

    assert.strictEqual(response.success, false)
    assert.strictEqual(response.message, '帳號已被註冊過')
  })

})
