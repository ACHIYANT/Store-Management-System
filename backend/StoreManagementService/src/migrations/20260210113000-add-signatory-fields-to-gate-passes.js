"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("GatePasses", "issued_signatory_emp_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn("GatePasses", "issued_signatory_name", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(
      "GatePasses",
      "issued_signatory_designation",
      {
        type: Sequelize.STRING,
        allowNull: true,
      },
    );
    await queryInterface.addColumn("GatePasses", "issued_signatory_division", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("GatePasses", "vendor_signatory_name", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("GatePasses", "vendor_signatory_address", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("GatePasses", "vendor_signatory_address");
    await queryInterface.removeColumn("GatePasses", "vendor_signatory_name");
    await queryInterface.removeColumn("GatePasses", "issued_signatory_division");
    await queryInterface.removeColumn(
      "GatePasses",
      "issued_signatory_designation",
    );
    await queryInterface.removeColumn("GatePasses", "issued_signatory_name");
    await queryInterface.removeColumn("GatePasses", "issued_signatory_emp_id");
  },
};
