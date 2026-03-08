"use strict";

const hasTable = async (queryInterface, tableName) => {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS c
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = :tableName
    `,
    { replacements: { tableName } },
  );
  return Number(rows?.[0]?.c || 0) > 0;
};

const hasIndex = async (queryInterface, tableName, indexName) => {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT COUNT(*) AS c
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = :tableName
        AND index_name = :indexName
    `,
    { replacements: { tableName, indexName } },
  );
  return Number(rows?.[0]?.c || 0) > 0;
};

const addIndexIfMissing = async (
  queryInterface,
  tableName,
  fields,
  options = {},
) => {
  if (options?.name && (await hasIndex(queryInterface, tableName, options.name))) {
    return;
  }
  await queryInterface.addIndex(tableName, fields, options);
};

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "ForensicAuditLogs"))) {
      await queryInterface.createTable("ForensicAuditLogs", {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        request_id: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        service_name: {
          type: Sequelize.STRING(64),
          allowNull: false,
          defaultValue: "AuthService",
        },
        environment: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: "development",
        },
        method: {
          type: Sequelize.STRING(10),
          allowNull: false,
        },
        route_path: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        action: {
          type: Sequelize.STRING(160),
          allowNull: true,
        },
        entity_type: {
          type: Sequelize.STRING(80),
          allowNull: true,
        },
        entity_id: {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        status_code: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        success: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        duration_ms: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        actor_user_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        actor_emp_code: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        actor_name: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        actor_roles: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        source_ip: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        user_agent: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        query_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        request_body_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        response_body_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        metadata_json: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        archived_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    await addIndexIfMissing(queryInterface, "ForensicAuditLogs", ["createdAt"], {
      name: "idx_faudit_logs_created_at",
    });
    await addIndexIfMissing(
      queryInterface,
      "ForensicAuditLogs",
      ["actor_user_id", "createdAt"],
      { name: "idx_faudit_logs_actor_created_at" },
    );
    await addIndexIfMissing(
      queryInterface,
      "ForensicAuditLogs",
      ["entity_type", "entity_id", "createdAt"],
      { name: "idx_faudit_logs_entity_created_at" },
    );
    await addIndexIfMissing(
      queryInterface,
      "ForensicAuditLogs",
      ["action", "createdAt"],
      { name: "idx_faudit_logs_action_created_at" },
    );
    await addIndexIfMissing(
      queryInterface,
      "ForensicAuditLogs",
      ["status_code", "createdAt"],
      { name: "idx_faudit_logs_status_created_at" },
    );
    await addIndexIfMissing(queryInterface, "ForensicAuditLogs", ["request_id"], {
      name: "idx_faudit_logs_request_id",
    });
    await addIndexIfMissing(
      queryInterface,
      "ForensicAuditLogs",
      ["route_path", "createdAt"],
      { name: "idx_faudit_logs_route_created_at" },
    );

    if (!(await hasTable(queryInterface, "ForensicAuditArchives"))) {
      await queryInterface.createTable("ForensicAuditArchives", {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        archive_file_name: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        archive_file_path: {
          type: Sequelize.STRING(512),
          allowNull: false,
        },
        checksum_sha256: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        record_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        first_log_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        last_log_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        first_event_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        last_event_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        archived_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "ForensicAuditArchives",
      ["archived_at"],
      { name: "idx_faudit_archives_archived_at" },
    );
    await addIndexIfMissing(
      queryInterface,
      "ForensicAuditArchives",
      ["expires_at"],
      { name: "idx_faudit_archives_expires_at" },
    );
  },

  async down(queryInterface) {
    if (await hasTable(queryInterface, "ForensicAuditArchives")) {
      await queryInterface.dropTable("ForensicAuditArchives");
    }
    if (await hasTable(queryInterface, "ForensicAuditLogs")) {
      await queryInterface.dropTable("ForensicAuditLogs");
    }
  },
};

