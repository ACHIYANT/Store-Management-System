"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Stock extends Model {
    static associate(models) {
      // Associations
      this.belongsTo(models.ItemCategory, {
        foreignKey: "item_category_id", // Referencing ItemCategory
        onDelete: "CASCADE",
      });
      this.belongsTo(models.ItemMaster, {
        foreignKey: "item_master_id",
        as: "itemMaster",
      });
      this.hasMany(models.StockMovement, {
        foreignKey: "stock_id",
        as: "movements",
      });
      // this.hasMany(models.IssuedItem, {
      //   foreignKey: "item_id",
      //   onDelete: "CASCADE",
      // });
      // this.hasMany(models.Ewaste, {
      //   foreignKey: "item_id",
      //   onDelete: "CASCADE",
      // });
      this.hasMany(models.DayBookItem, {
        foreignKey: "stock_id",
        onDelete: "CASCADE",
      });
    }
  }
  Stock.init(
    {
      item_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sku_unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Unit",
      },
      rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      gst_rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      item_category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "ItemCategories",
          key: "id", // Referencing ItemCategory table's id
        },
      },
      item_master_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      source: {
        type: DataTypes.ENUM("DAYBOOK", "MIGRATION"),
        allowNull: false,
        defaultValue: "DAYBOOK",
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Stock",
    },
  );
  return Stock;
};
