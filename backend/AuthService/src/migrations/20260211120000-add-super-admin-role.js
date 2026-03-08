"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO Roles (name, createdAt, updatedAt)
      SELECT 'SUPER_ADMIN', NOW(), NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM Roles WHERE name = 'SUPER_ADMIN'
      )
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM Roles WHERE name = 'SUPER_ADMIN'
    `);
  },
};

