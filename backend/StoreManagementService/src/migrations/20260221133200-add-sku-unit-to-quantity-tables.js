"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("DayBookItems", "sku_unit", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "Unit",
    });

    await queryInterface.addColumn("Stocks", "sku_unit", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "Unit",
    });

    await queryInterface.addColumn("IssuedItems", "sku_unit", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "Unit",
    });

    await queryInterface.addColumn("RequisitionItems", "sku_unit", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "Unit",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("RequisitionItems", "sku_unit");
    await queryInterface.removeColumn("IssuedItems", "sku_unit");
    await queryInterface.removeColumn("Stocks", "sku_unit");
    await queryInterface.removeColumn("DayBookItems", "sku_unit");
  },
};
