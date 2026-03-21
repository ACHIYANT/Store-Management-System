"use strict";
const { ROLE_TABLE } = require("../constants/table-names");

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO \`${ROLE_TABLE}\` (name, createdAt, updatedAt)
      SELECT 'SUPER_ADMIN', NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM \`${ROLE_TABLE}\` WHERE name = 'SUPER_ADMIN'
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM \`${ROLE_TABLE}\` WHERE name = 'SUPER_ADMIN'
    `);
  },
};
