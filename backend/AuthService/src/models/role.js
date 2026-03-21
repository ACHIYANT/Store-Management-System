"use strict";
const { Model } = require("sequelize");
const { ROLE_TABLE, USER_ROLE_TABLE } = require("../constants/table-names");
module.exports = (sequelize, DataTypes) => {
  class Role extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Role.belongsToMany(models.User, {
        through: USER_ROLE_TABLE,
        as: "users",
        foreignKey: "RoleId",
        otherKey: "UserId",
      });
    }
  }
  Role.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Role",
      tableName: ROLE_TABLE,
    }
  );
  return Role;
};
