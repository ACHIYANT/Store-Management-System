"use strict";
const { Model } = require("sequelize");
const { ITEM_CATEGORY_HEAD_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ItemCategoryHead extends Model {
    static associate(models) {
      ItemCategoryHead.hasMany(models.ItemCategoryGroup, {
        foreignKey: "head_id",
        as: "groups",
      });
    }
  }

  ItemCategoryHead.init(
    {
      category_head_name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
    },
    {
      sequelize,
      modelName: "ItemCategoryHead",
      tableName: ITEM_CATEGORY_HEAD_TABLE,
    },
  );

  return ItemCategoryHead;
};
