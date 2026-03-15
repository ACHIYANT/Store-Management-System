"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class IssuedItem extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Employee, {
        foreignKey: "employee_id",
        onDelete: "CASCADE",
      });
      this.belongsTo(models.Stock, {
        foreignKey: "item_id",
        onDelete: "CASCADE",
      });
      this.belongsTo(models.ItemMaster, {
        foreignKey: "item_master_id",
        as: "itemMaster",
      });
      this.belongsTo(models.Custodian, {
        foreignKey: "custodian_id",
        targetKey: "id",
      });
      IssuedItem.belongsTo(models.Requisition, {
        foreignKey: "requisition_id",
      });
      IssuedItem.belongsTo(models.RequisitionItem, {
        foreignKey: "requisition_item_id",
      });
      // IssuedItem.belongsTo(models.Employee, { foreignKey: "employee_id" });
      IssuedItem.hasMany(models.AssetEvent, { foreignKey: "issued_item_id" });
    }
  }
  IssuedItem.init(
    {
      employee_id: DataTypes.INTEGER,
      custodian_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      custodian_type: {
        type: DataTypes.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
        allowNull: true,
      },
      item_id: DataTypes.INTEGER,
      item_master_id: DataTypes.BIGINT.UNSIGNED,
      quantity: DataTypes.INTEGER,
      sku_unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "Unit",
      },
      date: DataTypes.DATE,
      requisition_url: DataTypes.STRING, // NEW
      requisition_id: DataTypes.BIGINT.UNSIGNED,
      requisition_item_id: DataTypes.BIGINT.UNSIGNED,
      source: {
        type: DataTypes.ENUM(
          "OFFLINE_REQUISITION",
          "ONLINE_REQUISITION",
          "MIGRATION",
        ),
        allowNull: false,
        defaultValue: "OFFLINE_REQUISITION",
      },
    },
    {
      sequelize,
      modelName: "IssuedItem",
    }
  );
  return IssuedItem;
};
