"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Custodians", "location", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE Custodians c
      INNER JOIN Employees e ON e.emp_id = c.employee_id
      SET c.location = e.office_location
      WHERE c.custodian_type = 'EMPLOYEE';
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("Custodians", "location");
  },
};
