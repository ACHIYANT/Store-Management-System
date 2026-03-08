"use strict";
const { Model } = require("sequelize");
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
            if (!/^[A-Z0-9]{15}$/.test(normalized)) {
              throw new Error(
                "Only capital letters and digits are allowed and GST must be exactly 15 characters.",
              );
            }
          },
        },
      },
      mobile_no: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        validate: {
          notEmpty: true,
          isNumeric: true,
          len: [10, 10], // Exactly 10 digits
          is: {
            args: /^[6-9]\d{9}$/, // Optional: Only Indian-style mobile numbers
            msg: "Mobile number must be 10 digits and start with 6-9",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Vendors",
    }
  );
  return Vendors;
};
