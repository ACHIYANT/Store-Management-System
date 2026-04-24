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
        replacements: [ROLE_TABLE, "VEHICLE_DRIVER", ROLE_TABLE, "VEHICLE_DRIVER"],
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM ?? WHERE name = ?`,
      {
        replacements: [ROLE_TABLE, "VEHICLE_DRIVER"],
      },
    );
  },
};
