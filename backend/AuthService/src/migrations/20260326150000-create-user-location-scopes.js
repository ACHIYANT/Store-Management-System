"use strict";

const {
  USER_LOCATION_SCOPE_TABLE,
  USER_TABLE,
} = require("../constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(USER_LOCATION_SCOPE_TABLE, {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: USER_TABLE,
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      location_scope: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scope_label: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      effective_from: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      effective_to: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      ended_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex(USER_LOCATION_SCOPE_TABLE, ["user_id", "active"], {
      name: "idx_user_location_scopes_user_active",
    });
    await queryInterface.addIndex(
      USER_LOCATION_SCOPE_TABLE,
      ["location_scope", "active"],
      {
        name: "idx_user_location_scopes_scope_active",
      },
    );
    await queryInterface.addIndex(
      USER_LOCATION_SCOPE_TABLE,
      ["user_id", "location_scope", "active"],
      {
        name: "idx_user_location_scopes_user_scope_active",
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(USER_LOCATION_SCOPE_TABLE);
  },
};
