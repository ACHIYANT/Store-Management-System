"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class DayBook extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsTo(models.Vendors, {
        foreignKey: "vendor_id",
        onDelete: "CASCADE",
      });
      this.hasMany(models.DayBookItem, {
        foreignKey: "daybook_id",
        onDelete: "CASCADE",
      });
      DayBook.hasMany(models.DayBookAdditionalCharge, {
        foreignKey: "daybook_id",
        // as: "additionalCharges",
      });
    }
  }
  DayBook.init(
    {
      entry_no: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      entry_type: {
        type: DataTypes.ENUM(
          "Fixed Assets",
          "Consumable Items",
          "Vehicle Items",
          "Stationary Items"
        ),
        allowNull: false,
      },
      bill_no: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      bill_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      vendor_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Vendors",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      total_amount: {
        type: DataTypes.DECIMAL,
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      bill_image_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      item_image_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      approval_level: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      fin_year: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          isInt: true,
          len: [4, 4],
          min: 2000,
        },
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        // Keep this as STRING because historic rows can contain
        // workflow states beyond a fixed enum (e.g. MRN cancellation states).
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Pending",
      },
      mrn_security_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      approved_by_user_ids: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // other_charges: {
      //   type: DataTypes.DECIMAL,
      //   allowNull: true,
      //   defaultValue: 0,
      //   validate: {
      //     min: 0,
      //   },
      // },
    },
    {
      sequelize,
      modelName: "DayBook",
    }
  );
  return DayBook;
};
