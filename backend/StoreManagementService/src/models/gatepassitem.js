"use strict";
const { Model } = require("sequelize");
const { GATE_PASS_ITEM_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class GatePassItem extends Model {
    static associate(models) {
      this.belongsTo(models.GatePass, {
        foreignKey: "gate_pass_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
      this.belongsTo(models.Asset, {
        foreignKey: "asset_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }
  }

  GatePassItem.init(
    {
      gate_pass_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      asset_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      asset_tag_snapshot: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      serial_number_snapshot: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      out_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      out_verified_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      in_verified_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      in_verified_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "GatePassItem",
      tableName: GATE_PASS_ITEM_TABLE,
    },
  );

  return GatePassItem;
};
