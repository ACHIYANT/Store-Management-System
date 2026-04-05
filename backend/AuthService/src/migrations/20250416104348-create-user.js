"use strict";
const { USER_TABLE } = require("../constants/table-names");
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(USER_TABLE, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      empcode: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          isNumeric: true,
        },
      },
      fullname: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          len: [3, 100],
          is: {
            args: /^[A-Za-z]+(?:\.?[A-Za-z]+)*\.?(?: [A-Za-z]+(?:\.?[A-Za-z]+)*\.?)*$/,
            msg: "Only letters, periods, and single spaces are allowed. No leading/trailing/multiple spaces.",
          },
        },
      },
      mobileno: {
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
      password: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: {
            args: [8, 100],
            msg: "Password must be at least 8 characters long",
          },
          is: {
            args: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
            msg: "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character",
          },
        },
      },
      designation: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      division: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      must_change_password: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      password_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      password_changed_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
    await queryInterface.dropTable(USER_TABLE);
  },
};
