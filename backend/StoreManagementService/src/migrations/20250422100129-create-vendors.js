"use strict";

const { sequelize } = require("../models");
const VENDOR_NAME_REGEX = /^[A-Za-z0-9&.,'()/\-]+(?: [A-Za-z0-9&.,'()/\-]+)*$/;

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Vendors", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [3, 200],
          is: {
            args: VENDOR_NAME_REGEX,
            msg: "Vendor name can contain letters, numbers, spaces, and common symbols (& . , ' ( ) / -). Use single spaces only.",
          },
        },
      },
      address: {
        type: Sequelize.STRING,
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
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          len: [15, 15],
          is: {
            args: /^[A-Z0-9]{15}$/,
            msg: "Only capital letters and digits are allowed and GST must be exactly 15 characters.",
          },
        },
      },
      mobile_no: {
        type: Sequelize.STRING,
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
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Vendors");
  },
};
