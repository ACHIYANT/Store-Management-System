"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE Vendors
      SET gst_no = NULL
      WHERE gst_no IS NOT NULL AND TRIM(gst_no) = ''
    `);

    await queryInterface.changeColumn("Vendors", "gst_no", {
      type: Sequelize.STRING(15),
      allowNull: true,
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE Vendors
      SET gst_no = CONCAT('UNREG', LPAD(id, 10, '0'))
      WHERE gst_no IS NULL
    `);

    await queryInterface.changeColumn("Vendors", "gst_no", {
      type: Sequelize.STRING(15),
      allowNull: false,
      unique: true,
    });
  },
};

