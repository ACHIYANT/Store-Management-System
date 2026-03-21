"use strict";
const { ROLE_TABLE } = require("../constants/table-names");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO \`${ROLE_TABLE}\` (name, createdAt, updatedAt)
      SELECT 'DIVISION_HEAD', NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM \`${ROLE_TABLE}\` WHERE name = 'DIVISION_HEAD'
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM \`${ROLE_TABLE}\` WHERE name = 'DIVISION_HEAD'
    `);
  },
};
