"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Collapse repeated spaces in existing vendor names so they align with validation rules.
    for (let i = 0; i < 5; i += 1) {
      await queryInterface.sequelize.query(`
        UPDATE Vendors
        SET name = TRIM(REPLACE(name, '  ', ' '))
        WHERE name LIKE '%  %'
      `);
    }
  },

  async down() {
    // Irreversible data-normalization migration.
  },
};

