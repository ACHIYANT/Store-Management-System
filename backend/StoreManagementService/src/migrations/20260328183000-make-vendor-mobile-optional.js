"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE Vendors
      SET mobile_no = NULL
      WHERE mobile_no IS NOT NULL AND TRIM(mobile_no) = ''
    `);

    await queryInterface.changeColumn("Vendors", "mobile_no", {
      type: Sequelize.STRING(10),
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE Vendors
      SET mobile_no = CONCAT('9', LPAD(id, 9, '0'))
      WHERE mobile_no IS NULL OR TRIM(mobile_no) = ''
    `);

    await queryInterface.changeColumn("Vendors", "mobile_no", {
      type: Sequelize.STRING(10),
      allowNull: false,
      unique: true,
    });
  },
};

