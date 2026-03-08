"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("AssetEvents", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      // Core links
      asset_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Assets", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      // Lifecycle
      event_type: {
        type: Sequelize.ENUM(
          "Created",
          "Issued",
          "Returned",
          "Transferred",
          "SubmittedToStore",
          "RepairOut",
          "RepairIn",
          "Adjusted",
          "Disposed",
          "Lost"
        ),
        allowNull: false,
      },
      event_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      // Custody (Employees use emp_id as PK)
      from_employee_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Employees", key: "emp_id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      to_employee_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "Employees", key: "emp_id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // Optional audit links
      daybook_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "DayBooks", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      daybook_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "DayBookItems", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      issued_item_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "IssuedItems", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      // Notes
      notes: { type: Sequelize.TEXT, allowNull: true },
      performed_by: { type: Sequelize.STRING, allowNull: true },

      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    // Helpful indexes
    await queryInterface.addIndex("AssetEvents", ["asset_id", "event_date"]);
    await queryInterface.addIndex("AssetEvents", ["event_type"]);
    await queryInterface.addIndex("AssetEvents", ["issued_item_id"]);
  },

  async down(queryInterface, Sequelize) {
    // Drop table first
    await queryInterface.dropTable("AssetEvents");

    // Then drop the ENUM type (Postgres-safe; ignored by MySQL)
    // The enum name is what sequelize generates: enum_<TableName>_<ColumnName>
    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_AssetEvents_event_type";'
      );
    }
  },
};
