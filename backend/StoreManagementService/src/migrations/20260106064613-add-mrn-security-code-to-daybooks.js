"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("DayBooks", "mrn_security_code", {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
      after: "entry_no", // optional, works in MySQL
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("DayBooks", "mrn_security_code");
  },
};
