"use strict";
const { Model } = require("sequelize");
const {
  MATERIAL_ISSUE_RECEIPT_TABLE,
} = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class MaterialIssueReceipt extends Model {
    static associate(models) {
      this.belongsTo(models.Requisition, {
        as: "requisition",
        foreignKey: "requisition_id",
      });
    }
  }

  MaterialIssueReceipt.init(
    {
      mir_no: {
        type: DataTypes.STRING(80),
        allowNull: false,
        unique: true,
      },
      requisition_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
      },
      requisition_req_no: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      receiver_type: {
        type: DataTypes.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
        allowNull: false,
      },
      receiver_ref_id: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      receiver_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      receiver_designation: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      receiver_division: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      signatory_role: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      signatory_scope_key: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      signatory_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      signatory_empcode: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      signatory_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      signatory_designation: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      signatory_division: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      issued_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      printed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("PENDING_SIGNATURE", "SIGNED_UPLOADED"),
        allowNull: false,
        defaultValue: "PENDING_SIGNATURE",
      },
      signed_mir_url: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      uploaded_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      uploaded_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      uploaded_by_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "MaterialIssueReceipt",
      tableName: MATERIAL_ISSUE_RECEIPT_TABLE,
    },
  );

  return MaterialIssueReceipt;
};
