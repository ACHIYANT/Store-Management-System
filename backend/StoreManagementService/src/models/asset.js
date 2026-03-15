"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Asset extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      // An asset belongs to its stock definition
      this.belongsTo(models.Stock, { foreignKey: "stock_id" }); // :contentReference[oaicite:0]{index=0}
      this.belongsTo(models.ItemMaster, {
        foreignKey: "item_master_id",
        as: "itemMaster",
      });
      this.belongsTo(models.ItemCategory, { foreignKey: "item_category_id" }); // :contentReference[oaicite:1]{index=1}
      this.belongsTo(models.DayBook, { foreignKey: "daybook_id" }); // :contentReference[oaicite:2]{index=2}
      this.belongsTo(models.DayBookItem, { foreignKey: "daybook_item_id" }); // :contentReference[oaicite:3]{index=3}
      this.belongsTo(models.Vendors, { foreignKey: "vendor_id" }); // :contentReference[oaicite:4]{index=4}
      this.belongsTo(models.Employee, { foreignKey: "current_employee_id" }); // :contentReference[oaicite:5]{index=5}

      // Later: AssetEvent will be linked here
      this.hasMany(models.AssetEvent, { foreignKey: "asset_id" });
      this.hasMany(models.GatePassItem, { foreignKey: "asset_id" });
    }
  }
  Asset.init(
    {
      serial_number: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM(
          "InStore",
          "Issued",
          "InTransit",
          "Repair",
          "EWaste",
          "EWasteOut",
          "Disposed",
          "Lost",
          "Retained",
          "Removed as MRN Cancelled",
        ),
        allowNull: false,
        defaultValue: "InStore",
      },
      purchased_at: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      warranty_expiry: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      asset_tag: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      custodian_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      custodian_type: {
        type: DataTypes.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
        allowNull: true,
      },
      item_master_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Asset",
    },
  );
  return Asset;
};
