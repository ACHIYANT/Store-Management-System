"use strict";

/** @type {import('sequelize-cli').Migration} */

const USER_ROLES_TABLE = "User_Roles";

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
    const hasCanonicalTable = await tableExists(queryInterface, USER_ROLES_TABLE);
    if (hasCanonicalTable) {
      return;
    }

    await queryInterface.createTable(USER_ROLES_TABLE, {
      UserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: {
          model: "Users",
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
          model: "Roles",
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
    const hasCanonicalTable = await tableExists(queryInterface, USER_ROLES_TABLE);
    if (!hasCanonicalTable) {
      return;
    }

    await queryInterface.dropTable(USER_ROLES_TABLE);
  },
};
