"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ForensicAuditArchive extends Model {
    static associate() {}
  }

  ForensicAuditArchive.init(
    {
      archive_file_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      archive_file_path: {
        type: DataTypes.STRING(512),
        allowNull: false,
      },
      checksum_sha256: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      record_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      first_log_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      last_log_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      first_event_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      last_event_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      archived_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ForensicAuditArchive",
    },
  );

  return ForensicAuditArchive;
};

