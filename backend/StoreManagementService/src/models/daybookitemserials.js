"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class DayBookItemSerial extends Model {
    static associate(models) {
      this.belongsTo(models.DayBookItem, {
        foreignKey: "daybook_item_id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }
  }

  DayBookItemSerial.init(
    {
      daybook_item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      serial_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true, // staging-level uniqueness
        validate: { notEmpty: true },
      },
      purchased_at: { type: DataTypes.DATEONLY, allowNull: true },
      warranty_expiry: { type: DataTypes.DATEONLY, allowNull: true },
      asset_tag: { type: DataTypes.STRING, allowNull: true },
      source: {
        type: DataTypes.ENUM("DAYBOOK", "MIGRATION"),
        allowNull: false,
        defaultValue: "DAYBOOK",
      },
      migrated_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "DayBookItemSerial",
      tableName: "DayBookItemSerials",
    }
  );

  return DayBookItemSerial;
};
