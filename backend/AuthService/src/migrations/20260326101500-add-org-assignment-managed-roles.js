"use strict";

const { ROLE_TABLE } = require("../constants/table-names");

const ROLE_NAMES = [
  "DIVISION_CUSTODIAN",
  "LOCATION_INCHARGE",
  "STORE_INCHARGE",
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    for (const roleName of ROLE_NAMES) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO ?? (name, createdAt, updatedAt)
        SELECT ?, NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM ?? WHERE name = ?
        )
      `,
        {
          replacements: [ROLE_TABLE, roleName, ROLE_TABLE, roleName],
        },
      );
    }
  },

  async down(queryInterface) {
    for (const roleName of ROLE_NAMES) {
      await queryInterface.sequelize.query(`DELETE FROM ?? WHERE name = ?`, {
        replacements: [ROLE_TABLE, roleName],
      });
    }
  },
};
