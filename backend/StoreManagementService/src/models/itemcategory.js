"use strict";
const { Model } = require("sequelize");
const { ITEM_CATEGORY_TABLE } = require("../constants/table-names");
module.exports = (sequelize, DataTypes) => {
  class ItemCategory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      // Associations
      this.hasMany(models.Stock, {
        foreignKey: "item_category_id", // Linking to Stock
        onDelete: "CASCADE",
      });
      this.hasMany(models.DayBookItem, {
        foreignKey: "item_category_id", // Linking to DayBookItem
        onDelete: "CASCADE",
      });
      this.hasMany(models.Asset, {
        foreignKey: "item_category_id",
        onDelete: "CASCADE",
      });
      this.belongsTo(models.ItemCategoryGroup, {
        foreignKey: "group_id",
        as: "group",
      });
    }
  }
  ItemCategory.init(
    {
      category_name: {
        type: DataTypes.STRING,
      },
      serialized_required: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ItemCategory",
      tableName: ITEM_CATEGORY_TABLE,
    },
  );
  return ItemCategory;
};
