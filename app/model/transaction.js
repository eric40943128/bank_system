'use strict'

module.exports = app => {
  const { STRING, INTEGER, DECIMAL } = app.Sequelize

  const BankTransaction = app.model.define('BankTransaction', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: INTEGER, allowNull: false },
    amount: { type: DECIMAL(20, 2), allowNull: false, defaultValue: 0.00 },
    balance: { type: DECIMAL(20, 2), allowNull: false, defaultValue: 0.00 },
    type: { type: STRING(10), allowNull: false },
  }, {
    tableName: 'Transactions',
    timestamps: true,
  })

  BankTransaction.associate = () => {
    const { User } = app.model
    BankTransaction.belongsTo(User, { foreignKey: 'userId' })
  }

  return BankTransaction
}
