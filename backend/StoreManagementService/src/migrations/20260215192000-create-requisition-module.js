"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Requisitions", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      req_no: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },
      requester_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      requester_emp_id: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      requester_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      requester_division: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM(
          "Draft",
          "Submitted",
          "InReview",
          "PartiallyApproved",
          "Approved",
          "Rejected",
          "Cancelled",
          "Fulfilling",
          "Fulfilled",
        ),
        allowNull: false,
        defaultValue: "Draft",
      },
      current_stage_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      current_stage_role: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      final_approved_at: {
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

    await queryInterface.createTable("RequisitionItems", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      requisition_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "Requisitions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      item_no: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      item_category_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "ItemCategories",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      stock_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "Stocks",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      particulars: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      requested_qty: {
        type: Sequelize.DECIMAL(14, 3),
        allowNull: false,
      },
      approved_qty: {
        type: Sequelize.DECIMAL(14, 3),
        allowNull: false,
        defaultValue: 0,
      },
      issued_qty: {
        type: Sequelize.DECIMAL(14, 3),
        allowNull: false,
        defaultValue: 0,
      },
      item_status: {
        type: Sequelize.ENUM(
          "Pending",
          "Approved",
          "PartiallyApproved",
          "Rejected",
          "Fulfilled",
          "Cancelled",
        ),
        allowNull: false,
        defaultValue: "Pending",
      },
      remarks: {
        type: Sequelize.TEXT,
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

    await queryInterface.createTable("RequisitionActions", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      requisition_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "Requisitions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      requisition_item_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: "RequisitionItems",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      stage_order: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      stage_role: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      acted_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      acted_by_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      acted_by_role: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      action: {
        type: Sequelize.ENUM(
          "Create",
          "Submit",
          "Approve",
          "Forward",
          "Reject",
          "QtyReduce",
          "Cancel",
          "Fulfill",
        ),
        allowNull: false,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      payload_json: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      action_at: {
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

    await queryInterface.createTable("RequisitionAttachments", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      requisition_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: "Requisitions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      action_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: "RequisitionActions",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      attachment_type: {
        type: Sequelize.ENUM(
          "NotingApproval",
          "Supporting",
          "OfflineRequisition",
        ),
        allowNull: false,
        defaultValue: "Supporting",
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      mime_type: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      uploaded_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
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

    await queryInterface.addColumn("IssuedItems", "requisition_id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: "Requisitions",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addColumn("IssuedItems", "requisition_item_id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: "RequisitionItems",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex(
      "Requisitions",
      ["status", "current_stage_order", "updatedAt", "id"],
      { name: "idx_requisitions_status_stage_updatedat_id" },
    );
    await queryInterface.addIndex(
      "Requisitions",
      ["requester_user_id", "updatedAt", "id"],
      { name: "idx_requisitions_requester_updatedat_id" },
    );
    await queryInterface.addIndex(
      "Requisitions",
      ["requester_emp_id", "updatedAt", "id"],
      { name: "idx_requisitions_requester_emp_updatedat_id" },
    );

    await queryInterface.addIndex(
      "RequisitionItems",
      ["requisition_id", "item_status", "id"],
      { name: "idx_requisitionitems_req_itemstatus_id" },
    );
    await queryInterface.addIndex(
      "RequisitionItems",
      ["stock_id", "item_status", "id"],
      { name: "idx_requisitionitems_stock_itemstatus_id" },
    );

    await queryInterface.addIndex(
      "RequisitionActions",
      ["requisition_id", "action_at", "id"],
      { name: "idx_requisitionactions_req_actionat_id" },
    );
    await queryInterface.addIndex(
      "RequisitionActions",
      ["acted_by_user_id", "action_at", "id"],
      { name: "idx_requisitionactions_actor_actionat_id" },
    );

    await queryInterface.addIndex(
      "RequisitionAttachments",
      ["requisition_id", "createdAt", "id"],
      { name: "idx_requisitionattachments_req_createdat_id" },
    );

    await queryInterface.addIndex(
      "IssuedItems",
      ["requisition_id", "date", "id"],
      { name: "idx_issueditems_reqid_date_id" },
    );
    await queryInterface.addIndex(
      "IssuedItems",
      ["requisition_item_id", "date", "id"],
      { name: "idx_issueditems_reqitem_date_id" },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "IssuedItems",
      "idx_issueditems_reqitem_date_id",
    );
    await queryInterface.removeIndex("IssuedItems", "idx_issueditems_reqid_date_id");

    await queryInterface.removeIndex(
      "RequisitionAttachments",
      "idx_requisitionattachments_req_createdat_id",
    );

    await queryInterface.removeIndex(
      "RequisitionActions",
      "idx_requisitionactions_actor_actionat_id",
    );
    await queryInterface.removeIndex(
      "RequisitionActions",
      "idx_requisitionactions_req_actionat_id",
    );

    await queryInterface.removeIndex(
      "RequisitionItems",
      "idx_requisitionitems_stock_itemstatus_id",
    );
    await queryInterface.removeIndex(
      "RequisitionItems",
      "idx_requisitionitems_req_itemstatus_id",
    );

    await queryInterface.removeIndex(
      "Requisitions",
      "idx_requisitions_requester_emp_updatedat_id",
    );
    await queryInterface.removeIndex(
      "Requisitions",
      "idx_requisitions_requester_updatedat_id",
    );
    await queryInterface.removeIndex(
      "Requisitions",
      "idx_requisitions_status_stage_updatedat_id",
    );

    await queryInterface.removeColumn("IssuedItems", "requisition_item_id");
    await queryInterface.removeColumn("IssuedItems", "requisition_id");

    await queryInterface.dropTable("RequisitionAttachments");
    await queryInterface.dropTable("RequisitionActions");
    await queryInterface.dropTable("RequisitionItems");
    await queryInterface.dropTable("Requisitions");
  },
};
