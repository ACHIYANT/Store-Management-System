"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AssetEvent extends Model {
    static associate(models) {
      // Required
      this.belongsTo(models.Asset, {
        foreignKey: "asset_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // Employees (PK = emp_id)
      this.belongsTo(models.Employee, {
        as: "fromEmployee",
        foreignKey: "from_employee_id",
        targetKey: "emp_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
      this.belongsTo(models.Employee, {
        as: "toEmployee",
        foreignKey: "to_employee_id",
        targetKey: "emp_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });

      // Optional audit links
      this.belongsTo(models.DayBook, {
        foreignKey: "daybook_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
      this.belongsTo(models.DayBookItem, {
        foreignKey: "daybook_item_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
      this.belongsTo(models.IssuedItem, {
        foreignKey: "issued_item_id",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
      this.belongsTo(models.Custodian, {
        foreignKey: "custodian_id",
        targetKey: "id",
      });
      AssetEvent.belongsTo(models.Asset, { foreignKey: "asset_id" });
      AssetEvent.belongsTo(models.IssuedItem, { foreignKey: "issued_item_id" });
    }
  }

  AssetEvent.init(
    {
      event_type: {
        type: DataTypes.ENUM(
          "Created",
          "OpeningBalance",
          "Issued",
          "Returned",
          "Transferred",
          "SubmittedToStore",
          "RepairOut",
          "RepairIn",
          "MarkedEWaste",
          "EWasteOut",
          "Adjusted",
          "Disposed",
          "Lost",
          "Retained",
          "MRN Cancelled"
        ),
        allowNull: false,
      },
      event_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      custodian_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      custodian_type: {
        type: DataTypes.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
        allowNull: true,
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      approval_document_url: { type: DataTypes.TEXT, allowNull: true },
      performed_by: { type: DataTypes.STRING, allowNull: true },
    },
    {
      sequelize,
      modelName: "AssetEvent",
    }
  );

  return AssetEvent;
};
