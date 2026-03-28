"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Employees", "gender", {
      type: Sequelize.ENUM("Male", "Female", "Other"),
      allowNull: false,
      defaultValue: "Other",
    });
  },

  async down(queryInterface, _Sequelize) {
    await queryInterface.removeColumn("Employees", "gender");
  },
};

