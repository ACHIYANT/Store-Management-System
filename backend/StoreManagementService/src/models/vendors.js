"use strict";
const { Model } = require("sequelize");
const { VENDOR_TABLE } = require("../constants/table-names");

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

module.exports = (sequelize, DataTypes) => {
  class Vendors extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.hasMany(models.DayBook, {
        foreignKey: "vendor_id",
      });
    }
  }
  Vendors.init(
    {
      // vendor_id: {
      //   type: DataTypes.INTEGER,
      //   allowNull: false,
      //   autoIncrement: true,
      //   primaryKey: true,
      // },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [3, 200],
          is: {
            args: /^[A-Za-z]+(?: [A-Za-z]+)*$/,
            msg: "Only letters and single spaces are allowed. No leading/trailing/multiple spaces.",
          },
        },
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [3, 300],
          // is: {
          //   args: /^[A-Za-z]+(?: [A-Za-z]+)*$/,
          //   msg: "Only letters and single spaces are allowed. No leading/trailing/multiple spaces.",
          // },
        },
      },
      gst_no: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
          isValidGstNo(value) {
            if (value === null || value === undefined || String(value).trim() === "") {
              return;
            }

            const normalized = String(value).trim().toUpperCase();
            if (!GST_REGEX.test(normalized)) {
              throw new Error(
                "Invalid GST format. Use: 2 digits + PAN(10 chars) + entity code + Z + checksum. Example: 06ABCDE1234F1Z5.",
              );
            }
          },
        },
      },
      mobile_no: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true,
        validate: {
          isValidMobileNo(value) {
            if (value === null || value === undefined || String(value).trim() === "") {
              return;
            }

            const normalized = String(value).trim();
            if (!/^[6-9]\d{9}$/.test(normalized)) {
              throw new Error("Mobile number must be 10 digits and start with 6-9");
            }
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Vendors",
      tableName: VENDOR_TABLE,
    }
  );
  return Vendors;
};
