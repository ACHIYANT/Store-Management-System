"use strict";

async function hasColumn(queryInterface, tableName, columnName) {
  const schema = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(schema, columnName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    if (!(await hasColumn(queryInterface, "AssetEvents", "approval_document_url"))) {
      await queryInterface.addColumn("AssetEvents", "approval_document_url", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_Assets_status" ADD VALUE IF NOT EXISTS 'Retained';`,
      );
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_AssetEvents_event_type" ADD VALUE IF NOT EXISTS 'Retained';`,
      );
    } else {
      await queryInterface.sequelize.query(`
        ALTER TABLE Assets
        MODIFY COLUMN status ENUM(
          'InStore',
          'Issued',
          'InTransit',
          'Repair',
          'EWaste',
          'EWasteOut',
          'Disposed',
          'Lost',
          'Retained',
          'Removed as MRN Cancelled'
        ) NOT NULL DEFAULT 'InStore';
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE AssetEvents
        MODIFY COLUMN event_type ENUM(
          'Created',
          'OpeningBalance',
          'Issued',
          'Returned',
          'Transferred',
          'SubmittedToStore',
          'RepairOut',
          'RepairIn',
          'MarkedEWaste',
          'EWasteOut',
          'Adjusted',
          'Disposed',
          'Lost',
          'Retained',
          'MRN Cancelled'
        ) NOT NULL;
      `);
    }
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (await hasColumn(queryInterface, "AssetEvents", "approval_document_url")) {
      await queryInterface.removeColumn("AssetEvents", "approval_document_url");
    }

    if (dialect !== "postgres") {
      await queryInterface.sequelize.query(`
        ALTER TABLE AssetEvents
        MODIFY COLUMN event_type ENUM(
          'Created',
          'OpeningBalance',
          'Issued',
          'Returned',
          'Transferred',
          'SubmittedToStore',
          'RepairOut',
          'RepairIn',
          'MarkedEWaste',
          'EWasteOut',
          'Adjusted',
          'Disposed',
          'Lost',
          'MRN Cancelled'
        ) NOT NULL;
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE Assets
        MODIFY COLUMN status ENUM(
          'InStore',
          'Issued',
          'InTransit',
          'Repair',
          'EWaste',
          'EWasteOut',
          'Disposed',
          'Lost',
          'Removed as MRN Cancelled'
        ) NOT NULL DEFAULT 'InStore';
      `);
    }
  },
};
