"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addConstraint("DayBooks", {
      fields: ["entry_no"],
      type: "unique",
      name: "unique_daybook_entry_no",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint(
      "DayBooks",
      "unique_daybook_entry_no",
    );
  },
};
