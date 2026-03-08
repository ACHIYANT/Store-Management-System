"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("GatePasses", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      pass_no: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      security_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      purpose: {
        type: Sequelize.ENUM("RepairOut"),
        allowNull: false,
        defaultValue: "RepairOut",
      },
      status: {
        type: Sequelize.ENUM("Open", "OutVerified", "InVerified"),
        allowNull: false,
        defaultValue: "Open",
      },
      issued_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      out_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      in_verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_by: {
        type: Sequelize.STRING,
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

    await queryInterface.addIndex("GatePasses", ["status"]);
    await queryInterface.addIndex("GatePasses", ["issued_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("GatePasses");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_GatePasses_purpose";',
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_GatePasses_status";',
      );
    }
  },
};
