"use strict";
const { Model } = require("sequelize");
const { FORENSIC_AUDIT_LOG_TABLE } = require("../constants/table-names");

module.exports = (sequelize, DataTypes) => {
  class ForensicAuditLog extends Model {
    static associate() {}
  }

  ForensicAuditLog.init(
    {
      request_id: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      service_name: {
        type: DataTypes.STRING(64),
        allowNull: false,
        defaultValue: "StoreManagementService",
      },
      environment: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "development",
      },
      method: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      route_path: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      action: {
        type: DataTypes.STRING(160),
        allowNull: true,
      },
      entity_type: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      entity_id: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      status_code: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      success: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      duration_ms: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      actor_user_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      actor_emp_code: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      actor_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      actor_roles: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      source_ip: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      query_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      request_body_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      response_body_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata_json: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      archived_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "ForensicAuditLog",
      tableName: FORENSIC_AUDIT_LOG_TABLE,
    },
  );

  return ForensicAuditLog;
};
