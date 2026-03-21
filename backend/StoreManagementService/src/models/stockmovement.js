"use strict";
const { Model } = require("sequelize");
const { STOCK_MOVEMENT_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class StockMovement extends Model {
    static associate(models) {
      this.belongsTo(models.ItemMaster, {
        foreignKey: "item_master_id",
        as: "itemMaster",
      });
      this.belongsTo(models.Stock, {
        foreignKey: "stock_id",
        as: "stock",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "from_employee_id",
        targetKey: "emp_id",
        as: "fromEmployee",
      });
      this.belongsTo(models.Employee, {
        foreignKey: "to_employee_id",
        targetKey: "emp_id",
        as: "toEmployee",
      });
    }
  }

  StockMovement.init(
    {
      item_master_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      stock_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      movement_type: {
        type: DataTypes.ENUM(
          "OPENING_BALANCE",
          "DAYBOOK_IN",
          "ISSUE_OUT",
          "RETURN_IN",
          "TRANSFER_OUT",
          "TRANSFER_IN",
          "REPAIR_OUT",
          "REPAIR_IN",
          "ADJUST_PLUS",
          "ADJUST_MINUS",
          "DISPOSE_OUT",
          "LOST_OUT",
          "RETAIN_OUT",
          "EWASTE_OUT",
          "MRN_CANCELLED",
        ),
        allowNull: false,
      },
      qty: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
      },
      sku_unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Unit",
      },
      movement_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      reference_type: {
        type: DataTypes.STRING(40),
        allowNull: true,
      },
      reference_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      from_employee_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      to_employee_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      performed_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "StockMovement",
      tableName: STOCK_MOVEMENT_TABLE,
    },
  );

  return StockMovement;
};
