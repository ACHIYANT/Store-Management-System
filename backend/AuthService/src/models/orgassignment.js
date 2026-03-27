"use strict";

const { Model } = require("sequelize");
const { ORG_ASSIGNMENT_TABLE, USER_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class OrgAssignment extends Model {
    static associate(models) {
      OrgAssignment.belongsTo(models.User, {
        as: "user",
        foreignKey: "user_id",
        targetKey: "id",
      });
    }
  }

  OrgAssignment.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: USER_TABLE,
          key: "id",
        },
      },
      assignment_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scope_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scope_key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      scope_label: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      metadata_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
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
      modelName: "OrgAssignment",
      tableName: ORG_ASSIGNMENT_TABLE,
    },
  );

  return OrgAssignment;
};
