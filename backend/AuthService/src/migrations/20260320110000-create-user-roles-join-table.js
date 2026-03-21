"use strict";
const {
  ROLE_TABLE,
  USER_ROLE_TABLE,
  USER_TABLE,
} = require("../constants/table-names");

/** @type {import('sequelize-cli').Migration} */
async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const hasCanonicalTable = await tableExists(queryInterface, USER_ROLE_TABLE);
    if (hasCanonicalTable) {
      return;
    }

    await queryInterface.createTable(USER_ROLE_TABLE, {
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: USER_TABLE,
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      RoleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: ROLE_TABLE,
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
  },

  async down(queryInterface) {
    const hasCanonicalTable = await tableExists(queryInterface, USER_ROLE_TABLE);
    if (!hasCanonicalTable) {
      return;
    }

    await queryInterface.dropTable(USER_ROLE_TABLE);
  },
};
