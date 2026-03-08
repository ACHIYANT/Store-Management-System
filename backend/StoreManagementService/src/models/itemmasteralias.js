"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ItemMasterAlias extends Model {
    static associate(models) {
      this.belongsTo(models.ItemMaster, {
        foreignKey: "item_master_id",
        as: "itemMaster",
      });
    }
  }

  ItemMasterAlias.init(
    {
      item_master_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      alias_text: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      normalized_alias: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "ItemMasterAlias",
    },
  );

  return ItemMasterAlias;
};

