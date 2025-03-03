'use strict'

const { Model, DataTypes } = require('sequelize')

class BankTransaction extends Model {
  static associate(models) {
    console.log('BankTransaction 關聯設定開始')
    BankTransaction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' })
    console.log('BankTransaction 關聯設定完成')
  }
}

module.exports = sequelize => {
  console.log('🔄 BankTransaction 模型正在初始化')

  BankTransaction.init(
    {
      amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
    },
    {
      sequelize, // 使用 egg-sequelize 提供的實例
      modelName: 'BankTransaction',
      tableName: 'Transactions',
      timestamps: true,
    }
  )

  console.log('✅ BankTransaction 模型已加載，表名稱:', BankTransaction.tableName)

  return BankTransaction
}
