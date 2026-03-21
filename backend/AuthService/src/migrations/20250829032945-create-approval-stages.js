// *** authservice/src/migrations/20250829090000-create-approval-stages.js
"use strict";
const { APPROVAL_STAGES_TABLE } = require("../constants/table-names");
module.exports = {
  async up(qi, Sequelize) {
    await qi.createTable(APPROVAL_STAGES_TABLE, {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      role_name: { type: Sequelize.STRING, allowNull: false }, // e.g. "ADMIN_APPROVER"
      stage_order: { type: Sequelize.INTEGER, allowNull: false }, // 1,2,3,...
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },
  async down(qi) {
    await qi.dropTable(APPROVAL_STAGES_TABLE);
  },
};
