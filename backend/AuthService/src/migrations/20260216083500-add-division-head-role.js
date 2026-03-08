"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO Roles (name, createdAt, updatedAt)
      SELECT 'DIVISION_HEAD', NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM Roles WHERE name = 'DIVISION_HEAD'
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM Roles WHERE name = 'DIVISION_HEAD'
    `);
  },
};
