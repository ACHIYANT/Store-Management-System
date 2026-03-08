"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RequisitionAttachment extends Model {
    static associate(models) {
      this.belongsTo(models.Requisition, {
        as: "requisition",
        foreignKey: "requisition_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.belongsTo(models.RequisitionAction, {
        as: "action",
        foreignKey: "action_id",
      });
    }
  }

  RequisitionAttachment.init(
    {
      requisition_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      action_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      attachment_type: {
        type: DataTypes.ENUM(
          "NotingApproval",
          "Supporting",
          "OfflineRequisition",
        ),
        allowNull: false,
        defaultValue: "Supporting",
      },
      file_url: { type: DataTypes.TEXT, allowNull: false },
      file_name: { type: DataTypes.STRING(255), allowNull: true },
      mime_type: { type: DataTypes.STRING(120), allowNull: true },
      uploaded_by_user_id: { type: DataTypes.INTEGER, allowNull: false },
      uploaded_by_name: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: "RequisitionAttachment",
    },
  );

  return RequisitionAttachment;
};
