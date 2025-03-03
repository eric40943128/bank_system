/** @type Egg.EggPlugin */
module.exports = {
  sequelize: {
    enable: false,
    package: 'egg-sequelize',
  },
  redis: {
    enable: true,
    package: 'egg-redis',
  },
  nunjucks: {
    enable: true,
    package: 'egg-view-nunjucks',
  },
}
