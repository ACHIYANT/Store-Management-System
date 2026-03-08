// *** authservice/src/models/approval_stages.js
"use strict";
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
    {},
  );
  return ApprovalStage;
};
