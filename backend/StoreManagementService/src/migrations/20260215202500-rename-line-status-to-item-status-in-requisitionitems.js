"use strict";

async function hasIndex(queryInterface, tableName, indexName) {
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((idx) => idx?.name === indexName);
}

module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable("RequisitionItems");

    if (table?.line_status && !table?.item_status) {
      await queryInterface.renameColumn(
        "RequisitionItems",
        "line_status",
        "item_status",
      );
    }

    const hasOldReqIndex = await hasIndex(
      queryInterface,
      "RequisitionItems",
      "idx_requisitionitems_req_linestatus_id",
    );
    const hasOldStockIndex = await hasIndex(
      queryInterface,
      "RequisitionItems",
      "idx_requisitionitems_stock_linestatus_id",
    );

    if (
      !hasOldReqIndex &&
      !(await hasIndex(
        queryInterface,
        "RequisitionItems",
        "idx_requisitionitems_req_itemstatus_id",
      ))
    ) {
      await queryInterface.addIndex(
        "RequisitionItems",
        ["requisition_id", "item_status", "id"],
        { name: "idx_requisitionitems_req_itemstatus_id" },
      );
    }

    if (
      !hasOldStockIndex &&
      !(await hasIndex(
        queryInterface,
        "RequisitionItems",
        "idx_requisitionitems_stock_itemstatus_id",
      ))
    ) {
      await queryInterface.addIndex("RequisitionItems", ["stock_id", "item_status", "id"], {
        name: "idx_requisitionitems_stock_itemstatus_id",
      });
    }
  },

  async down(queryInterface) {
    if (
      await hasIndex(
        queryInterface,
        "RequisitionItems",
        "idx_requisitionitems_req_itemstatus_id",
      )
    ) {
      await queryInterface.removeIndex(
        "RequisitionItems",
        "idx_requisitionitems_req_itemstatus_id",
      );
    }
    if (
      await hasIndex(
        queryInterface,
        "RequisitionItems",
        "idx_requisitionitems_stock_itemstatus_id",
      )
    ) {
      await queryInterface.removeIndex(
        "RequisitionItems",
        "idx_requisitionitems_stock_itemstatus_id",
      );
    }

    const table = await queryInterface.describeTable("RequisitionItems");
    if (table?.item_status && !table?.line_status) {
      await queryInterface.renameColumn(
        "RequisitionItems",
        "item_status",
        "line_status",
      );
    }

    const hasCurrentReqIndex = await hasIndex(
      queryInterface,
      "RequisitionItems",
      "idx_requisitionitems_req_itemstatus_id",
    );
    const hasCurrentStockIndex = await hasIndex(
      queryInterface,
      "RequisitionItems",
      "idx_requisitionitems_stock_itemstatus_id",
    );

    if (!hasCurrentReqIndex && !(await hasIndex(
      queryInterface,
      "RequisitionItems",
      "idx_requisitionitems_req_linestatus_id",
    ))) {
      await queryInterface.addIndex(
        "RequisitionItems",
        ["requisition_id", "line_status", "id"],
        { name: "idx_requisitionitems_req_linestatus_id" },
      );
    }

    if (!hasCurrentStockIndex && !(await hasIndex(
      queryInterface,
      "RequisitionItems",
      "idx_requisitionitems_stock_linestatus_id",
    ))) {
      await queryInterface.addIndex("RequisitionItems", ["stock_id", "line_status", "id"], {
        name: "idx_requisitionitems_stock_linestatus_id",
      });
    }
  },
};
