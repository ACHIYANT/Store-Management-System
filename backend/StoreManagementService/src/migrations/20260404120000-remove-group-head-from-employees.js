"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("Employees");
    if (table.group_head) {
      await queryInterface.removeColumn("Employees", "group_head");
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("Employees");
    if (!table.group_head) {
      await queryInterface.addColumn("Employees", "group_head", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },
};
