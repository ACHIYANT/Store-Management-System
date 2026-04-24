"use strict";
const { ROLE_TABLE } = require("../constants/table-names");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `
      INSERT INTO ?? (name, createdAt, updatedAt)
      SELECT ?, NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM ?? WHERE name = ?
      )
    `,
      {
        replacements: [ROLE_TABLE, "DIVISION_HEAD", ROLE_TABLE, "DIVISION_HEAD"],
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM ?? WHERE name = ?`,
      {
        replacements: [ROLE_TABLE, "DIVISION_HEAD"],
      },
    );
  },
};
