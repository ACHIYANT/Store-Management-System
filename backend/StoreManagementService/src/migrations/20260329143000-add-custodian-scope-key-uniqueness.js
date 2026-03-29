"use strict";

const UNIQUE_SCOPE_TYPES = new Set(["DIVISION", "VEHICLE"]);
const UNIQUE_SCOPE_INDEX_NAME = "uq_custodians_scope_key";

const normalizeToken = (value) => {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, " ").toUpperCase();
  return text || null;
};

const buildScopeKey = (row) => {
  const type = normalizeToken(row?.custodian_type);
  if (!UNIQUE_SCOPE_TYPES.has(type)) return null;
  const displayName = normalizeToken(row?.display_name);
  const location = normalizeToken(row?.location);
  if (!displayName || !location) return null;
  return `${type}|${location}|${displayName}`;
};

const hasColumn = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  return Boolean(table?.[columnName]);
};

const hasIndex = async (queryInterface, tableName, indexName) => {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "Custodians";

    if (!(await hasColumn(queryInterface, tableName, "scope_key"))) {
      await queryInterface.addColumn(tableName, "scope_key", {
        type: Sequelize.STRING(512),
        allowNull: true,
      });
    }

    const rows = await queryInterface.sequelize.query(
      `
        SELECT id, custodian_type, display_name, location
        FROM Custodians
        ORDER BY createdAt ASC, id ASC
      `,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const seen = new Set();
    for (const row of rows) {
      const scopeKey = buildScopeKey(row);
      let valueToPersist = scopeKey;

      // Keep the earliest row canonical; older duplicates stay but are neutralized.
      if (scopeKey && seen.has(scopeKey)) {
        valueToPersist = null;
      } else if (scopeKey) {
        seen.add(scopeKey);
      }

      await queryInterface.bulkUpdate(
        tableName,
        { scope_key: valueToPersist },
        { id: String(row.id) },
      );
    }

    if (!(await hasIndex(queryInterface, tableName, UNIQUE_SCOPE_INDEX_NAME))) {
      await queryInterface.addIndex(tableName, ["scope_key"], {
        unique: true,
        name: UNIQUE_SCOPE_INDEX_NAME,
      });
    }
  },

  async down(queryInterface) {
    const tableName = "Custodians";

    if (await hasIndex(queryInterface, tableName, UNIQUE_SCOPE_INDEX_NAME)) {
      await queryInterface.removeIndex(tableName, UNIQUE_SCOPE_INDEX_NAME);
    }
    if (await hasColumn(queryInterface, tableName, "scope_key")) {
      await queryInterface.removeColumn(tableName, "scope_key");
    }
  },
};

