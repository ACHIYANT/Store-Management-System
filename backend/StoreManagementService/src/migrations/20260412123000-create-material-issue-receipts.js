"use strict";

const {
  MATERIAL_ISSUE_RECEIPT_TABLE,
  REQUISITION_TABLE,
} = require("../constants/table-names");

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(MATERIAL_ISSUE_RECEIPT_TABLE, {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      mir_no: {
        type: Sequelize.STRING(80),
        allowNull: false,
        unique: true,
      },
      requisition_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        unique: true,
        references: {
          model: REQUISITION_TABLE,
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      requisition_req_no: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      location_scope: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      receiver_type: {
        type: Sequelize.ENUM("EMPLOYEE", "DIVISION", "VEHICLE"),
        allowNull: false,
      },
      receiver_ref_id: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      receiver_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      receiver_designation: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      receiver_division: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      signatory_role: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      signatory_scope_key: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      signatory_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      signatory_empcode: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      signatory_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      signatory_designation: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      signatory_division: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      issued_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      printed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("PENDING_SIGNATURE", "SIGNED_UPLOADED"),
        allowNull: false,
        defaultValue: "PENDING_SIGNATURE",
      },
      signed_mir_url: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      uploaded_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      uploaded_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      uploaded_by_name: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex(
      MATERIAL_ISSUE_RECEIPT_TABLE,
      ["issued_at", "id"],
      {
        name: "idx_mirs_issuedat_id",
      },
    );
    await queryInterface.addIndex(
      MATERIAL_ISSUE_RECEIPT_TABLE,
      ["status", "issued_at", "id"],
      {
        name: "idx_mirs_status_issuedat_id",
      },
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      MATERIAL_ISSUE_RECEIPT_TABLE,
      "idx_mirs_status_issuedat_id",
    );
    await queryInterface.removeIndex(
      MATERIAL_ISSUE_RECEIPT_TABLE,
      "idx_mirs_issuedat_id",
    );
    await queryInterface.dropTable(MATERIAL_ISSUE_RECEIPT_TABLE);
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_MaterialIssueReceipts_receiver_type";',
    ).catch(() => {});
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_MaterialIssueReceipts_status";',
    ).catch(() => {});
  },
};
