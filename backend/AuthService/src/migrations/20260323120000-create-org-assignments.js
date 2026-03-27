"use strict";

const {
  ORG_ASSIGNMENT_TABLE,
  USER_TABLE,
} = require("../constants/table-names");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(ORG_ASSIGNMENT_TABLE, {
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
      assignment_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scope_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scope_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scope_label: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      metadata_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
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
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex(
      ORG_ASSIGNMENT_TABLE,
      ["assignment_type", "scope_type", "scope_key", "active"],
      { name: "idx_org_assignments_scope_active" },
    );
    await queryInterface.addIndex(
      ORG_ASSIGNMENT_TABLE,
      ["user_id", "assignment_type", "active"],
      { name: "idx_org_assignments_user_type_active" },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      ORG_ASSIGNMENT_TABLE,
      "idx_org_assignments_scope_active",
    );
    await queryInterface.removeIndex(
      ORG_ASSIGNMENT_TABLE,
      "idx_org_assignments_user_type_active",
    );
    await queryInterface.dropTable(ORG_ASSIGNMENT_TABLE);
  },
};
