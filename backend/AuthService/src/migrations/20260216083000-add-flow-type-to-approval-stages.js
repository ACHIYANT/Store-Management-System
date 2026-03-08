"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("approval_stages", "flow_type", {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "DAYBOOK",
    });

    await queryInterface.sequelize.query(
      `UPDATE approval_stages SET flow_type = 'DAYBOOK' WHERE flow_type IS NULL OR flow_type = ''`,
    );

    await queryInterface.addIndex(
      "approval_stages",
      ["flow_type", "active", "stage_order"],
      { name: "idx_approval_stages_flow_active_order" },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "approval_stages",
      "idx_approval_stages_flow_active_order",
    );
    await queryInterface.removeColumn("approval_stages", "flow_type");
  },
};
