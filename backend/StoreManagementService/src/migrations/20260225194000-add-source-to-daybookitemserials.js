"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("DayBookItemSerials");

    if (!Object.prototype.hasOwnProperty.call(table, "source")) {
      await queryInterface.addColumn("DayBookItemSerials", "source", {
        type: Sequelize.ENUM("DAYBOOK", "MIGRATION"),
        allowNull: false,
        defaultValue: "DAYBOOK",
      });
    }

    const [indexes] = await queryInterface.sequelize.query(
      "SHOW INDEX FROM `DayBookItemSerials` WHERE Key_name = 'idx_daybookitemserials_source';",
    );
    if (!Array.isArray(indexes) || indexes.length === 0) {
      await queryInterface.addIndex("DayBookItemSerials", ["source"], {
        name: "idx_daybookitemserials_source",
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("DayBookItemSerials");
    if (!Object.prototype.hasOwnProperty.call(table, "source")) return;

    try {
      await queryInterface.removeIndex(
        "DayBookItemSerials",
        "idx_daybookitemserials_source",
      );
    } catch (error) {
      // ignore missing index
    }

    await queryInterface.removeColumn("DayBookItemSerials", "source");
  },
};

