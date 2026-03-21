"use strict";
const { Model } = require("sequelize");
const {
  DAYBOOK_ITEM_TABLE,
  DAYBOOK_TABLE,
  ITEM_CATEGORY_TABLE,
} = require("../constants/table-names");
module.exports = (sequelize, DataTypes) => {
  class DayBookItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.DayBook, {
        foreignKey: "daybook_id",
        onDelete: "CASCADE",
      });
      this.belongsTo(models.Stock, {
        foreignKey: "stock_id", // Link to Stock's id
        onDelete: "CASCADE",
      });
      this.belongsTo(models.ItemCategory, {
        foreignKey: "item_category_id", // Linking to ItemCategory
        onDelete: "CASCADE",
      });
      this.belongsTo(models.ItemMaster, {
        foreignKey: "item_master_id",
        as: "itemMaster",
      });
      // ✅ ADD THIS
      this.hasMany(models.DayBookItemSerial, {
        foreignKey: "daybook_item_id",
        // as: "DayBookItemSerial",
        onDelete: "CASCADE",
      });
    }
  }
  DayBookItem.init(
    {
      daybook_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: DAYBOOK_TABLE,
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      item_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      item_category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: ITEM_CATEGORY_TABLE,
          key: "id", // Link to ItemCategory table's id
        },
      },
      item_master_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
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
      gst_type: {
        type: DataTypes.ENUM("IGST", "CGST_SGST"),
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
      stock_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        // references: {
        //   model: "Stocks",
        //   key: "id", // Referencing Stock's id
        // },
      },
      temp_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "DayBookItem",
      tableName: DAYBOOK_ITEM_TABLE,
    },
  );
  return DayBookItem;
};
