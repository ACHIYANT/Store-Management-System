"use strict";
const { Model } = require("sequelize");
const { GATE_PASS_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class GatePass extends Model {
    static associate(models) {
      this.hasMany(models.GatePassItem, {
        as: "items",
        foreignKey: "gate_pass_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }
  }

  GatePass.init(
    {
      pass_no: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      security_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      purpose: {
        type: DataTypes.ENUM("RepairOut", "EWasteOut"),
        allowNull: false,
        defaultValue: "RepairOut",
      },
      status: {
        type: DataTypes.ENUM("Open", "OutVerified", "InVerified"),
        allowNull: false,
        defaultValue: "Open",
      },
      issued_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      out_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      in_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      location_scope: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      created_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      issued_signatory_emp_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      issued_signatory_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      issued_signatory_designation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      issued_signatory_division: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      vendor_signatory_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      vendor_signatory_address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "GatePass",
      tableName: GATE_PASS_TABLE,
    },
  );

  return GatePass;
};
