'use strict'

const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')
const basename = path.basename(__filename)
const config = require(path.resolve(__dirname, '../../config/sequelize.config.js')).development

const db = {}

// 初始化 Sequelize 實例
let sequelize
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config)
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config)
}

// 確認 Sequelize 實例是否正確
if (sequelize instanceof Sequelize) {
  console.log('✅ Sequelize 實例已正確建立')
} else {
  console.error('❌ Sequelize 實例建立失敗，請檢查設定')
}

// 📂 手動加載模型
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    )
  })
  .forEach(file => {
    console.log('📂 正在加載模型文件:', file)
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes)
    if (model) {
      db[model.name] = model
      console.log(`✅ 成功加載模型: ${model.name}`)
    } else {
      console.error(`❌ 模型文件 ${file} 加載失敗`)
    }
  })

// 🔗 設置模型關聯
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    console.log(`🔗 設置模型關聯: ${modelName}`)
    db[modelName].associate(db)
  }
})

console.log('已加載的模型：', Object.keys(db))

db.sequelize = sequelize
db.Sequelize = Sequelize

module.exports = db
