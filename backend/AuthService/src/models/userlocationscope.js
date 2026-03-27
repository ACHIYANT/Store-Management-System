"use strict";

const { Model } = require("sequelize");
const {
  USER_LOCATION_SCOPE_TABLE,
  USER_TABLE,
} = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class UserLocationScope extends Model {
    static associate(models) {
      UserLocationScope.belongsTo(models.User, {
        as: "user",
        foreignKey: "user_id",
        targetKey: "id",
      });
    }
  }

  UserLocationScope.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: USER_TABLE,
          key: "id",
        },
      },
      location_scope: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scope_label: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      effective_from: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      effective_to: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      created_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      ended_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "UserLocationScope",
      tableName: USER_LOCATION_SCOPE_TABLE,
    },
  );

  return UserLocationScope;
};
