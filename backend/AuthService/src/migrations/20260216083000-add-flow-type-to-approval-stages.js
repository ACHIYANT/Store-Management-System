"use strict";
const { APPROVAL_STAGES_TABLE } = require("../constants/table-names");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(APPROVAL_STAGES_TABLE, "flow_type", {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "DAYBOOK",
    });

    await queryInterface.sequelize.query(
      `UPDATE \`${APPROVAL_STAGES_TABLE}\` SET flow_type = 'DAYBOOK' WHERE flow_type IS NULL OR flow_type = ''`,
    );

    await queryInterface.addIndex(
      APPROVAL_STAGES_TABLE,
      ["flow_type", "active", "stage_order"],
      { name: "idx_approval_stages_flow_active_order" },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      APPROVAL_STAGES_TABLE,
      "idx_approval_stages_flow_active_order",
    );
    await queryInterface.removeColumn(APPROVAL_STAGES_TABLE, "flow_type");
  },
};
