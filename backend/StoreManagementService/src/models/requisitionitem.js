"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RequisitionItem extends Model {
    static associate(models) {
      this.belongsTo(models.Requisition, {
        as: "requisition",
        foreignKey: "requisition_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      this.belongsTo(models.ItemCategory, {
        as: "itemCategory",
        foreignKey: "item_category_id",
      });

      this.belongsTo(models.Stock, {
        as: "stock",
        foreignKey: "stock_id",
      });
      this.belongsTo(models.ItemMaster, {
        as: "itemMaster",
        foreignKey: "item_master_id",
      });

      this.hasMany(models.RequisitionAction, {
        as: "actions",
        foreignKey: "requisition_item_id",
      });

      this.hasMany(models.IssuedItem, {
        as: "issuedItems",
        foreignKey: "requisition_item_id",
      });
    }
  }

  RequisitionItem.init(
    {
      requisition_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      item_no: { type: DataTypes.INTEGER, allowNull: false },
      item_category_id: { type: DataTypes.INTEGER, allowNull: true },
      stock_id: { type: DataTypes.INTEGER, allowNull: true },
      item_master_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      particulars: { type: DataTypes.STRING(255), allowNull: false },
      requested_qty: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
      sku_unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Unit",
      },
      approved_qty: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        defaultValue: 0,
      },
      issued_qty: {
        type: DataTypes.DECIMAL(14, 3),
        allowNull: false,
        defaultValue: 0,
      },
      item_status: {
        type: DataTypes.ENUM(
          "Pending",
          "Approved",
          "PartiallyApproved",
          "Rejected",
          "Fulfilled",
          "Cancelled",
        ),
        allowNull: false,
        defaultValue: "Pending",
      },
      remarks: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: "RequisitionItem",
    },
  );

  return RequisitionItem;
};
