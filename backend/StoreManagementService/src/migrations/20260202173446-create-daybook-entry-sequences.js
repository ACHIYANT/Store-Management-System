"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("DayBookEntrySequences", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      entry_type: {
        type: Sequelize.ENUM("FA", "CI", "SI", "VI"),
        allowNull: false,
      },

      fin_year: {
        type: Sequelize.STRING(9), // e.g. 2025
        allowNull: false,
      },

      last_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        ),
      },
    });

    await queryInterface.addConstraint("DayBookEntrySequences", {
      fields: ["entry_type", "fin_year"],
      type: "unique",
      name: "unique_entry_type_fin_year",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("DayBookEntrySequences");
  },
};
