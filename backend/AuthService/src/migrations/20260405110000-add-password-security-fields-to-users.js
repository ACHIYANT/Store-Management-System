"use strict";

const { USER_TABLE } = require("../constants/table-names");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(USER_TABLE, "must_change_password", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn(USER_TABLE, "password_version", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn(USER_TABLE, "password_changed_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(USER_TABLE, "password_changed_at");
    await queryInterface.removeColumn(USER_TABLE, "password_version");
    await queryInterface.removeColumn(USER_TABLE, "must_change_password");
  },
};
