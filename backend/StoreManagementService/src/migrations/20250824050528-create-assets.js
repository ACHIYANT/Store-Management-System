"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    await queryInterface.createTable("Assets", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      serial_number: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      stock_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Stocks", // :contentReference[oaicite:0]{index=0}
          key: "id",
        },
        onDelete: "RESTRICT",
      },
      item_category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "ItemCategories", // :contentReference[oaicite:1]{index=1}
          key: "id",
        },
        onDelete: "RESTRICT",
      },
      daybook_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "DayBooks", // :contentReference[oaicite:2]{index=2}
          key: "id",
        },
        onDelete: "SET NULL",
      },
      daybook_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "DayBookItems", // :contentReference[oaicite:3]{index=3}
          key: "id",
        },
        onDelete: "SET NULL",
      },
      vendor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Vendors", // :contentReference[oaicite:4]{index=4}
          key: "id",
        },
        onDelete: "SET NULL",
      },
      status: {
        type: Sequelize.ENUM(
          "InStore",
          "Issued",
          "InTransit",
          "Repair",
          "Disposed",
          "Lost"
        ),
        allowNull: false,
        defaultValue: "InStore",
      },
      current_employee_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Employees", // :contentReference[oaicite:5]{index=5}
          key: "emp_id",
        },
        onDelete: "SET NULL",
      },
      purchased_at: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      warranty_expiry: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },
      asset_tag: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    await queryInterface.addIndex("Assets", ["serial_number"]);
    await queryInterface.addIndex("Assets", ["status"]);
    await queryInterface.addIndex("Assets", ["current_employee_id"]);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.dropTable("Assets");
  },
};
