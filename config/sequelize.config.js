module.exports = {
  development: {
    username: 'root',
    password: 'eric910831',
    database: 'bank_system',
    host: '127.0.0.1',
    dialect: 'mysql',
    port: 3306,
    timezone: '+08:00',
    logging: console.log,
    dialectOptions: {
      dateStrings: true,
      timezone: '+08:00', // 確保 MySQL 取出時間時也是台北時間
    },
  },
}
