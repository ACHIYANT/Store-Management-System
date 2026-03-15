"use strict";
const { Model } = require("sequelize");

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
    },
  );

  return Custodian;
};
