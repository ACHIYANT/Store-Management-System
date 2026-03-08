"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DayBookItems", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      daybook_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "DayBooks",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      item_category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ItemCategories",
          key: "id", // Linking to ItemCategory table's id
        },
        onDelete: "CASCADE",
      },
      item_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      gst_type: {
        type: Sequelize.ENUM("IGST", "CGST_SGST"),
        allowNull: false,
      },
      gst_rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      stock_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        // references: {
        //   model: "Stocks",
        //   key: "id", // Linking to Stock's id
        // },
        // onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("DayBookItems");
  },
};
