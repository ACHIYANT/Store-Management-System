// *** authservice/src/models/approval_stages.js
"use strict";
const { APPROVAL_STAGES_TABLE } = require("../constants/table-names");
module.exports = (sequelize, DataTypes) => {
  const ApprovalStage = sequelize.define(
    "approval_stages",
    {
      role_name: DataTypes.STRING,
      stage_order: DataTypes.INTEGER,
      flow_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "DAYBOOK",
      },
      active: DataTypes.BOOLEAN,
    },
    {
      tableName: APPROVAL_STAGES_TABLE,
    },
  );
  return ApprovalStage;
};
