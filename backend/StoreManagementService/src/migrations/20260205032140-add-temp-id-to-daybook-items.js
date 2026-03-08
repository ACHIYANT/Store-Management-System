"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("DayBookItems", "temp_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: "Temporary index from frontend to map serials",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("DayBookItems", "temp_id");
  },
};
