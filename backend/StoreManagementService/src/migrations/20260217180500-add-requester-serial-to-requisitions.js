"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Requisitions", "requester_serial_no", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addIndex(
      "Requisitions",
      ["requester_user_id", "requester_serial_no"],
      {
        name: "uq_requisitions_requesteruser_serial",
        unique: true,
      },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "Requisitions",
      "uq_requisitions_requesteruser_serial",
    );
    await queryInterface.removeColumn("Requisitions", "requester_serial_no");
  },
};

