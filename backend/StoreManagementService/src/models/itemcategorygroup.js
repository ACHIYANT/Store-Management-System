"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ItemCategoryGroup extends Model {
    static associate(models) {
      ItemCategoryGroup.belongsTo(models.ItemCategoryHead, {
        foreignKey: "head_id",
        as: "head",
      });

      ItemCategoryGroup.hasMany(models.ItemCategory, {
        foreignKey: "group_id",
        as: "items",
      });
    }
  }

  ItemCategoryGroup.init(
    {
      category_group_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      head_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ItemCategoryGroup",
      tableName: "ItemCategoryGroups",
    }
  );

  return ItemCategoryGroup;
};
