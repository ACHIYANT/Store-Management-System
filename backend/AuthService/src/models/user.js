"use strict";
const { Model } = require("sequelize");
const bcrypt = require("bcrypt");
const { SALT_ROUNDS } = require("../config/serverConfig");
const { USER_ROLE_TABLE, USER_TABLE } = require("../constants/table-names");
const {
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX,
} = require("../utils/password-policy");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      User.belongsToMany(models.Role, {
        through: USER_ROLE_TABLE,
        as: "roles",
        foreignKey: "UserId",
        otherKey: "RoleId",
      });
      User.hasMany(models.OrgAssignment, {
        as: "orgAssignments",
        foreignKey: "user_id",
        sourceKey: "id",
      });
      User.hasMany(models.UserLocationScope, {
        as: "userLocationScopes",
        foreignKey: "user_id",
        sourceKey: "id",
      });
    }
  }
  User.init(
    {
      empcode: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          isNumeric: true,
        },
      },
      fullname: {
        type: DataTypes.STRING,
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
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: {
            args: [8, 100],
            msg: "Password must be at least 8 characters long",
          },
          is: {
            args: PASSWORD_POLICY_REGEX,
            msg: PASSWORD_POLICY_MESSAGE,
          },
        },
      },
      designation: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      division: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      must_change_password: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      password_version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      password_changed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: USER_TABLE,
    }
  );
  User.beforeSave((user) => {
    if (!user.changed("password")) {
      return;
    }
    const rounds = Number.isFinite(Number(SALT_ROUNDS))
      ? Number(SALT_ROUNDS)
      : 12;
    const encryptedPassword = bcrypt.hashSync(user.password, rounds);
    user.password = encryptedPassword;
  });
  return User;
};
