"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("AssetEvents", "from_custodian_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("AssetEvents", "from_custodian_type", {
      type: Sequelize.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
      allowNull: true,
    });
    await queryInterface.addColumn("AssetEvents", "to_custodian_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("AssetEvents", "to_custodian_type", {
      type: Sequelize.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE AssetEvents
      SET from_custodian_id = CAST(from_employee_id AS CHAR),
          from_custodian_type = 'EMPLOYEE'
      WHERE from_employee_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE AssetEvents
      SET to_custodian_id = CAST(to_employee_id AS CHAR),
          to_custodian_type = 'EMPLOYEE'
      WHERE to_employee_id IS NOT NULL;
    `);

    await queryInterface.sequelize.query(`
      UPDATE AssetEvents
      SET to_custodian_id = custodian_id,
          to_custodian_type = custodian_type
      WHERE to_custodian_id IS NULL
        AND custodian_id IS NOT NULL;
    `);

    await queryInterface.addIndex("AssetEvents", [
      "from_custodian_type",
      "from_custodian_id",
    ]);
    await queryInterface.addIndex("AssetEvents", [
      "to_custodian_type",
      "to_custodian_id",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("AssetEvents", [
      "to_custodian_type",
      "to_custodian_id",
    ]);
    await queryInterface.removeIndex("AssetEvents", [
      "from_custodian_type",
      "from_custodian_id",
    ]);

    await queryInterface.removeColumn("AssetEvents", "to_custodian_type");
    await queryInterface.removeColumn("AssetEvents", "to_custodian_id");
    await queryInterface.removeColumn("AssetEvents", "from_custodian_type");
    await queryInterface.removeColumn("AssetEvents", "from_custodian_id");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_AssetEvents_from_custodian_type";',
      );
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_AssetEvents_to_custodian_type";',
      );
    }
  },
};

