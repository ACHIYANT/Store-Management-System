"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RequisitionAction extends Model {
    static associate(models) {
      this.belongsTo(models.Requisition, {
        as: "requisition",
        foreignKey: "requisition_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.belongsTo(models.RequisitionItem, {
        as: "item",
        foreignKey: "requisition_item_id",
      });

      this.hasMany(models.RequisitionAttachment, {
        as: "attachments",
        foreignKey: "action_id",
      });
    }
  }

  RequisitionAction.init(
    {
      requisition_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      requisition_item_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      stage_order: { type: DataTypes.INTEGER, allowNull: true },
      stage_role: { type: DataTypes.STRING(64), allowNull: true },
      acted_by_user_id: { type: DataTypes.INTEGER, allowNull: false },
      acted_by_name: { type: DataTypes.STRING(255), allowNull: true },
      acted_by_role: { type: DataTypes.STRING(64), allowNull: true },
      action: {
        type: DataTypes.ENUM(
          "Create",
          "Submit",
          "Approve",
          "Forward",
          "Reject",
          "QtyReduce",
          "Cancel",
          "Fulfill",
          "MapItem",
        ),
        allowNull: false,
      },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      payload_json: { type: DataTypes.JSON, allowNull: true },
      action_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      sequelize,
      modelName: "RequisitionAction",
    },
  );

  return RequisitionAction;
};
