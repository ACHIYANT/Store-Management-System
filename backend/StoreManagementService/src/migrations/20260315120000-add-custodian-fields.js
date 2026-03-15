"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Assets", "custodian_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("Assets", "custodian_type", {
      type: Sequelize.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
      allowNull: true,
    });

    await queryInterface.addColumn("IssuedItems", "custodian_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("IssuedItems", "custodian_type", {
      type: Sequelize.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
      allowNull: true,
    });

    await queryInterface.addColumn("AssetEvents", "custodian_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("AssetEvents", "custodian_type", {
      type: Sequelize.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE Assets
      SET custodian_id = current_employee_id, custodian_type = 'EMPLOYEE'
      WHERE current_employee_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      UPDATE IssuedItems
      SET custodian_id = employee_id, custodian_type = 'EMPLOYEE'
      WHERE employee_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      UPDATE AssetEvents
      SET custodian_id = COALESCE(to_employee_id, from_employee_id),
          custodian_type = 'EMPLOYEE'
      WHERE COALESCE(to_employee_id, from_employee_id) IS NOT NULL;
    `);

    await queryInterface.addIndex("Assets", ["custodian_type", "custodian_id"]);
    await queryInterface.addIndex("IssuedItems", [
      "custodian_type",
      "custodian_id",
    ]);
    await queryInterface.addIndex("AssetEvents", [
      "custodian_type",
      "custodian_id",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("AssetEvents", [
      "custodian_type",
      "custodian_id",
    ]);
    await queryInterface.removeIndex("IssuedItems", [
      "custodian_type",
      "custodian_id",
    ]);
    await queryInterface.removeIndex("Assets", [
      "custodian_type",
      "custodian_id",
    ]);

    await queryInterface.removeColumn("AssetEvents", "custodian_type");
    await queryInterface.removeColumn("AssetEvents", "custodian_id");
    await queryInterface.removeColumn("IssuedItems", "custodian_type");
    await queryInterface.removeColumn("IssuedItems", "custodian_id");
    await queryInterface.removeColumn("Assets", "custodian_type");
    await queryInterface.removeColumn("Assets", "custodian_id");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Assets_custodian_type";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_IssuedItems_custodian_type";'
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_AssetEvents_custodian_type";'
      );
    }
  },
};
