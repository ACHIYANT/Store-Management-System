"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DayBooks", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      entry_no: {
        type: Sequelize.STRING,
      },
      entry_type: {
        type: Sequelize.STRING,
      },
      bill_no: {
        type: Sequelize.STRING,
      },
      bill_date: {
        type: Sequelize.DATE,
      },
      vendor_id: {
        type: Sequelize.INTEGER,
        onDelete: "CASCADE",
        references: {
          model: "Vendors",
          key: "id",
          as: "vendor_id",
        },
        allowNull: false,
      },
      total_amount: {
        type: Sequelize.DECIMAL,
      },
      bill_image_url: {
        type: Sequelize.STRING,
      },
      item_image_url: {
        type: Sequelize.STRING,
      },
      approval_level: {
        type: Sequelize.INTEGER,
      },
      fin_year: {
        type: Sequelize.INTEGER,
      },
      remarks: {
        type: Sequelize.TEXT,
      },
      status: {
        type: Sequelize.STRING,
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
    await queryInterface.dropTable("DayBooks");
  },
};
