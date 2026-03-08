"use strict";

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = new Set(
    (tables || []).map((t) => (typeof t === "string" ? t : t.tableName || t)),
  );
  return normalized.has(tableName);
}

async function hasColumn(queryInterface, tableName, columnName) {
  const tableDef = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(tableDef, columnName);
}

async function hasIndex(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await hasColumn(queryInterface, "IssuedItems", "source"))) {
      await queryInterface.addColumn("IssuedItems", "source", {
        type: Sequelize.ENUM(
          "OFFLINE_REQUISITION",
          "ONLINE_REQUISITION",
          "MIGRATION",
        ),
        allowNull: false,
        defaultValue: "OFFLINE_REQUISITION",
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE IssuedItems
      SET source = 'OFFLINE_REQUISITION'
      WHERE source IS NULL OR source = '';
    `);

    await queryInterface.sequelize.query(`
      UPDATE IssuedItems
      SET source = 'ONLINE_REQUISITION'
      WHERE requisition_id IS NOT NULL;
    `);

    if (await hasTable(queryInterface, "StockMovements")) {
      await queryInterface.sequelize.query(`
        UPDATE IssuedItems i
        INNER JOIN StockMovements sm
          ON sm.reference_type = 'IssuedItem'
         AND sm.reference_id = i.id
        SET i.source = 'MIGRATION'
        WHERE i.source <> 'ONLINE_REQUISITION'
          AND (
            JSON_UNQUOTE(JSON_EXTRACT(sm.metadata_json, '$.source')) = 'MIGRATION_ISSUED'
            OR sm.performed_by = 'System Migration'
            OR sm.remarks LIKE 'Issued migration%'
          );
      `);
    }

    if (
      !(await hasIndex(
        queryInterface,
        "IssuedItems",
        "idx_issueditems_source_date_id",
      ))
    ) {
      await queryInterface.addIndex("IssuedItems", ["source", "date", "id"], {
        name: "idx_issueditems_source_date_id",
      });
    }
  },

  async down(queryInterface) {
    if (
      await hasIndex(
        queryInterface,
        "IssuedItems",
        "idx_issueditems_source_date_id",
      )
    ) {
      await queryInterface.removeIndex(
        "IssuedItems",
        "idx_issueditems_source_date_id",
      );
    }

    if (await hasColumn(queryInterface, "IssuedItems", "source")) {
      await queryInterface.removeColumn("IssuedItems", "source");
    }
  },
};

