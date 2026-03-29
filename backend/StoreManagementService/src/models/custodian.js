"use strict";
const { Model } = require("sequelize");
const { CUSTODIAN_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class Custodian extends Model {
    static associate(models) {
      this.belongsTo(models.Employee, {
        foreignKey: "employee_id",
        targetKey: "emp_id",
      });
      this.hasMany(models.Asset, {
        foreignKey: "custodian_id",
        sourceKey: "id",
      });
      this.hasMany(models.IssuedItem, {
        foreignKey: "custodian_id",
        sourceKey: "id",
      });
      this.hasMany(models.AssetEvent, {
        foreignKey: "custodian_id",
        sourceKey: "id",
      });
      this.hasMany(models.AssetEvent, {
        as: "fromAssetEvents",
        foreignKey: "from_custodian_id",
        sourceKey: "id",
      });
      this.hasMany(models.AssetEvent, {
        as: "toAssetEvents",
        foreignKey: "to_custodian_id",
        sourceKey: "id",
      });
    }
  }

  Custodian.init(
    {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
      },
      custodian_type: {
        type: DataTypes.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
        allowNull: false,
      },
      display_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      scope_key: {
        type: DataTypes.STRING(512),
        allowNull: true,
        unique: true,
      },
      employee_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "Custodian",
      tableName: CUSTODIAN_TABLE,
    },
  );

  return Custodian;
};
