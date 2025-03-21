'use strict'

module.exports = app => {
  const { STRING, INTEGER, DECIMAL } = app.Sequelize

  const User = app.model.define('User', {
    id: { type: INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: STRING(255), allowNull: false, unique: true },
    password: { type: STRING(255), allowNull: false },
    balance: { type: DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'Users',
    timestamps: true,
  })

  User.associate = () => {
    const { Transaction } = app.model
    User.hasMany(Transaction, { foreignKey: 'userId' })
  }

  return User
}
