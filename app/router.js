/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app

  // 設置首頁路由
  // 前端頁面路由
  router.get('/', controller.home.index) // 預設跳轉到登入頁面
  router.get('/login', controller.home.renderLogin)
  router.get('/register', controller.home.renderRegister)
  router.get('/dashboard', controller.home.renderDashboard)


  // 取得 CSRF Token API
  router.get('/api/csrf', controller.csrf.getToken)

  // 使用者相關
  router.post('/api/register', controller.user.register)
  router.post('/api/login', controller.user.login)
  router.post('/api/logout', controller.user.logout)
  router.get('/api/check-login', controller.user.checkLoginStatus)

  // 存提款操作
  router.post('/api/deposit', controller.transaction.deposit)
  router.post('/api/withdraw', controller.transaction.withdraw)

  // 查詢資料
  router.get('/api/balance', controller.user.getBalance)
  router.get('/api/transactions', controller.transaction.getTransactionHistory)

  // test
}
