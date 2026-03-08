"use strict";

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
    if (!(await hasColumn(queryInterface, "Stocks", "source"))) {
      await queryInterface.addColumn("Stocks", "source", {
        type: Sequelize.ENUM("DAYBOOK", "MIGRATION"),
        allowNull: false,
        defaultValue: "DAYBOOK",
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE Stocks s
      LEFT JOIN (
        SELECT DISTINCT stock_id
        FROM DayBookItems
        WHERE stock_id IS NOT NULL
      ) d
        ON d.stock_id = s.id
      SET s.source =
        CASE
          WHEN d.stock_id IS NOT NULL THEN 'DAYBOOK'
          ELSE 'MIGRATION'
        END;
    `);

    if (!(await hasIndex(queryInterface, "Stocks", "idx_stocks_source_active_id"))) {
      await queryInterface.addIndex("Stocks", ["source", "is_active", "id"], {
        name: "idx_stocks_source_active_id",
      });
    }
  },

  async down(queryInterface) {
    if (await hasIndex(queryInterface, "Stocks", "idx_stocks_source_active_id")) {
      await queryInterface.removeIndex("Stocks", "idx_stocks_source_active_id");
    }

    if (await hasColumn(queryInterface, "Stocks", "source")) {
      await queryInterface.removeColumn("Stocks", "source");
    }
  },
};

