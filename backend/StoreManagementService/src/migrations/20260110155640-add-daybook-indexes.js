"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("DayBooks", ["entry_no"], { unique: true });
    await queryInterface.addIndex("DayBooks", ["fin_year"]);
    await queryInterface.addIndex("DayBooks", ["approval_level"]);
    await queryInterface.addIndex("DayBooks", ["status"]);
    await queryInterface.addIndex("DayBooks", ["createdAt"]);
    await queryInterface.addIndex("DayBookItems", ["daybook_id"]);
    await queryInterface.addIndex("DayBookAdditionalCharges", ["daybook_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("DayBooks", ["entry_no"]);
    await queryInterface.removeIndex("DayBooks", ["fin_year"]);
    await queryInterface.removeIndex("DayBooks", ["approval_level"]);
    await queryInterface.removeIndex("DayBooks", ["status"]);
    await queryInterface.removeIndex("DayBooks", ["createdAt"]);
    await queryInterface.removeIndex("DayBookItems", ["daybook_id"]);
    await queryInterface.removeIndex("DayBookAdditionalCharges", [
      "daybook_id",
    ]);
  },
};
