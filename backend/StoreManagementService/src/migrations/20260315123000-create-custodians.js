"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Custodians", {
      id: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
      },
      custodian_type: {
        type: Sequelize.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
        allowNull: false,
      },
      display_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      scope_key: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Employees",
          key: "emp_id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });

    await queryInterface.addIndex("Custodians", ["custodian_type"]);
    await queryInterface.addIndex("Custodians", ["employee_id"], {
      unique: true,
    });
    await queryInterface.addIndex("Custodians", ["scope_key"], {
      unique: true,
      name: "uq_custodians_scope_key",
    });

    await queryInterface.sequelize.query(`
      INSERT INTO Custodians (id, custodian_type, display_name, employee_id, createdAt, updatedAt)
      SELECT CAST(emp_id AS CHAR), 'EMPLOYEE', name, emp_id, NOW(), NOW()
      FROM Employees;
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Custodians");

    if (queryInterface.sequelize.getDialect() === "postgres") {
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_Custodians_custodian_type";'
      );
    }
  },
};
