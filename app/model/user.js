'use strict'

const { Model, DataTypes, Sequelize } = require('sequelize')

class User extends Model {
  static associate(models) {
    console.log('User 關聯設定開始')
    User.hasMany(models.BankTransaction, { foreignKey: 'userId', as: 'transactions' })
    console.log('User 關聯設定完成')
  }
}

module.exports = sequelize => {
  console.log('🔄 User 模型正在初始化')

  if (!(sequelize instanceof Sequelize)) {
    console.error('❌ 傳入 User 模型的 sequelize 實例不正確')

    return null
  }

  User.init(
    {
      username: { type: DataTypes.STRING, allowNull: false },
      password: { type: DataTypes.STRING, allowNull: false },
      balance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users',
      timestamps: true,
    }
  )

  console.log('✅ User 模型已加載，表名稱:', User.tableName)

  return User
}
