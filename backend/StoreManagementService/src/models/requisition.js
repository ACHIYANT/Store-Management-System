"use strict";
const { Model } = require("sequelize");
const { REQUISITION_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class Requisition extends Model {
    static associate(models) {
      this.hasMany(models.RequisitionItem, {
        as: "items",
        foreignKey: "requisition_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.hasMany(models.RequisitionAction, {
        as: "actions",
        foreignKey: "requisition_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.hasMany(models.RequisitionAttachment, {
        as: "attachments",
        foreignKey: "requisition_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.hasMany(models.IssuedItem, {
        as: "issuedItems",
        foreignKey: "requisition_id",
      });
    }
  }

  Requisition.init(
    {
      req_no: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      requester_serial_no: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      requester_user_id: { type: DataTypes.INTEGER, allowNull: false },
      requester_emp_id: { type: DataTypes.STRING(40), allowNull: true },
      requester_name: { type: DataTypes.STRING(255), allowNull: true },
      requester_division: { type: DataTypes.STRING(255), allowNull: true },
      purpose: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM(
          "Draft",
          "Submitted",
          "InReview",
          "PartiallyApproved",
          "Approved",
          "Rejected",
          "Cancelled",
          "Fulfilling",
          "Fulfilled",
        ),
        allowNull: false,
        defaultValue: "Draft",
      },
      current_stage_order: { type: DataTypes.INTEGER, allowNull: true },
      current_stage_role: { type: DataTypes.STRING(64), allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      final_approved_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "Requisition",
      tableName: REQUISITION_TABLE,
    },
  );

  return Requisition;
};
