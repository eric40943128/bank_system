const { Controller } = require('egg')

class CsrfController extends Controller {
  async getToken() {
    const { ctx } = this

    ctx.body = { csrf: ctx.csrf }
  }
}

module.exports = CsrfController
