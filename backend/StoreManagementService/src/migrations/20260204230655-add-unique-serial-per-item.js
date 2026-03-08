"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("DayBookItemSerials", {
      fields: ["daybook_item_id", "serial_number"],
      type: "unique",
      name: "unique_daybook_item_serial",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      "DayBookItemSerials",
      "unique_daybook_item_serial",
    );
  },
};
