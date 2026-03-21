"use strict";
const { Model } = require("sequelize");
const { ITEM_MASTER_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ItemMaster extends Model {
    static associate(models) {
      this.belongsTo(models.ItemCategory, {
        foreignKey: "item_category_id",
      });

      this.hasMany(models.ItemMasterAlias, {
        foreignKey: "item_master_id",
        as: "aliases",
      });

      this.hasMany(models.Stock, {
        foreignKey: "item_master_id",
        as: "stocks",
      });

      this.hasMany(models.DayBookItem, {
        foreignKey: "item_master_id",
        as: "daybookItems",
      });

      this.hasMany(models.IssuedItem, {
        foreignKey: "item_master_id",
        as: "issuedItems",
      });

      this.hasMany(models.RequisitionItem, {
        foreignKey: "item_master_id",
        as: "requisitionItems",
      });

      this.hasMany(models.Asset, {
        foreignKey: "item_master_id",
        as: "assets",
      });

      this.hasMany(models.StockMovement, {
        foreignKey: "item_master_id",
        as: "movements",
      });
    }
  }

  ItemMaster.init(
    {
      item_code: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      display_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      normalized_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      item_category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sku_unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Unit",
      },
      serialized_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "ItemMaster",
      tableName: ITEM_MASTER_TABLE,
    },
  );

  return ItemMaster;
};
