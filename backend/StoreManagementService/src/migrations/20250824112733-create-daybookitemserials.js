"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DayBookItemSerials", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },

      daybook_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "DayBookItems", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      serial_number: {
        type: Sequelize.STRING,
        allowNull: false,
        // must be globally unique in staging to avoid ghost duplicates
        unique: true,
      },

      purchased_at: { type: Sequelize.DATEONLY, allowNull: true },
      warranty_expiry: { type: Sequelize.DATEONLY, allowNull: true },
      asset_tag: { type: Sequelize.STRING, allowNull: true },

      // null until moved into Assets, then set to the migration timestamp
      migrated_at: { type: Sequelize.DATE, allowNull: true },

      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex("DayBookItemSerials", ["daybook_item_id"]);
    await queryInterface.addIndex("DayBookItemSerials", ["migrated_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("DayBookItemSerials");
  },
};
