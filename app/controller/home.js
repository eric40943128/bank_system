const { Controller } = require('egg')

class HomeController extends Controller {
  async index() {
    this.ctx.redirect('/login')
  }

  async renderLogin() {
    await this.ctx.render('login.html')
  }

  async renderRegister() {
    await this.ctx.render('register.html')
  }

  async renderDashboard() {
    await this.ctx.render('dashboard.html')
  }
}

module.exports = HomeController
