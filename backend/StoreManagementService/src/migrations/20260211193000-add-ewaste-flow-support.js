"use strict";

async function hasIndex(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((idx) => idx.name === indexName);
}

module.exports = {
  async up(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_Assets_status" ADD VALUE IF NOT EXISTS 'EWaste';`,
      );
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_Assets_status" ADD VALUE IF NOT EXISTS 'EWasteOut';`,
      );
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_AssetEvents_event_type" ADD VALUE IF NOT EXISTS 'MarkedEWaste';`,
      );
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_AssetEvents_event_type" ADD VALUE IF NOT EXISTS 'EWasteOut';`,
      );
      await queryInterface.sequelize.query(
        `ALTER TYPE "enum_GatePasses_purpose" ADD VALUE IF NOT EXISTS 'EWasteOut';`,
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
          'MRN Cancelled'
        ) NOT NULL;
      `);

      await queryInterface.sequelize.query(`
        ALTER TABLE GatePasses
        MODIFY COLUMN purpose ENUM(
          'RepairOut',
          'EWasteOut'
        ) NOT NULL DEFAULT 'RepairOut';
      `);
    }

    if (
      !(await hasIndex(
        queryInterface,
        "Assets",
        "idx_assets_status_active_id",
      ))
    ) {
      await queryInterface.addIndex("Assets", ["status", "is_active", "id"], {
        name: "idx_assets_status_active_id",
      });
    }

    if (
      !(await hasIndex(
        queryInterface,
        "GatePasses",
        "idx_gatepasses_purpose_status_issuedat_id",
      ))
    ) {
      await queryInterface.addIndex(
        "GatePasses",
        ["purpose", "status", "issued_at", "id"],
        {
          name: "idx_gatepasses_purpose_status_issuedat_id",
        },
      );
    }

    if (
      !(await hasIndex(
        queryInterface,
        "AssetEvents",
        "idx_assetevents_type_eventdate_id",
      ))
    ) {
      await queryInterface.addIndex("AssetEvents", ["event_type", "event_date", "id"], {
        name: "idx_assetevents_type_eventdate_id",
      });
    }
  },

  async down(queryInterface) {
    const dialect = queryInterface.sequelize.getDialect();

    if (await hasIndex(queryInterface, "AssetEvents", "idx_assetevents_type_eventdate_id")) {
      await queryInterface.removeIndex("AssetEvents", "idx_assetevents_type_eventdate_id");
    }
    if (
      await hasIndex(
        queryInterface,
        "GatePasses",
        "idx_gatepasses_purpose_status_issuedat_id",
      )
    ) {
      await queryInterface.removeIndex(
        "GatePasses",
        "idx_gatepasses_purpose_status_issuedat_id",
      );
    }
    if (await hasIndex(queryInterface, "Assets", "idx_assets_status_active_id")) {
      await queryInterface.removeIndex("Assets", "idx_assets_status_active_id");
    }

    if (dialect !== "postgres") {
      await queryInterface.sequelize.query(`
        ALTER TABLE GatePasses
        MODIFY COLUMN purpose ENUM(
          'RepairOut'
        ) NOT NULL DEFAULT 'RepairOut';
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
          'Disposed',
          'Lost',
          'Removed as MRN Cancelled'
        ) NOT NULL DEFAULT 'InStore';
      `);
    }
  },
};
