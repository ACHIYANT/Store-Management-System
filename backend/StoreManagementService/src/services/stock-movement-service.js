"use strict";

const { StockMovement } = require("../models");
const { normalizeSkuUnit } = require("../utils/sku-units");

async function logStockMovement(
  {
    itemMasterId,
    stockId = null,
    movementType,
    qty,
    skuUnit = "Unit",
    movementAt = new Date(),
    referenceType = null,
    referenceId = null,
    fromEmployeeId = null,
    toEmployeeId = null,
    performedBy = null,
    remarks = null,
    locationScope = null,
    metadata = null,
  },
  { transaction = null } = {},
) {
  const itemMasterIdNum = Number(itemMasterId);
  if (!Number.isFinite(itemMasterIdNum) || itemMasterIdNum <= 0) return null;

  const qtyNum = Number(qty);
  if (!Number.isFinite(qtyNum) || qtyNum === 0) return null;

  const stockIdNum = Number(stockId);
  const refIdNum = Number(referenceId);
  const fromEmpIdNum = Number(fromEmployeeId);
  const toEmpIdNum = Number(toEmployeeId);

  return StockMovement.create(
    {
      item_master_id: itemMasterIdNum,
      stock_id: Number.isFinite(stockIdNum) && stockIdNum > 0 ? stockIdNum : null,
      movement_type: movementType,
      qty: qtyNum,
      sku_unit: normalizeSkuUnit(skuUnit || "Unit"),
      movement_at: movementAt || new Date(),
      reference_type: referenceType || null,
      reference_id: Number.isFinite(refIdNum) ? refIdNum : null,
      from_employee_id:
        Number.isFinite(fromEmpIdNum) && fromEmpIdNum > 0 ? fromEmpIdNum : null,
      to_employee_id:
        Number.isFinite(toEmpIdNum) && toEmpIdNum > 0 ? toEmpIdNum : null,
      performed_by: performedBy || null,
      remarks: remarks || null,
      location_scope: locationScope || null,
      metadata_json: metadata || null,
    },
    { transaction },
  );
}

async function logStockMovements(rows = [], { transaction = null } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const payload = [];
  for (const row of rows) {
    const itemMasterIdNum = Number(row?.itemMasterId);
    const qtyNum = Number(row?.qty);
    if (!Number.isFinite(itemMasterIdNum) || itemMasterIdNum <= 0) continue;
    if (!Number.isFinite(qtyNum) || qtyNum === 0) continue;

    const stockIdNum = Number(row?.stockId);
    const refIdNum = Number(row?.referenceId);
    const fromEmpIdNum = Number(row?.fromEmployeeId);
    const toEmpIdNum = Number(row?.toEmployeeId);

    payload.push({
      item_master_id: itemMasterIdNum,
      stock_id: Number.isFinite(stockIdNum) && stockIdNum > 0 ? stockIdNum : null,
      movement_type: row?.movementType,
      qty: qtyNum,
      sku_unit: normalizeSkuUnit(row?.skuUnit || "Unit"),
      movement_at: row?.movementAt || new Date(),
      reference_type: row?.referenceType || null,
      reference_id: Number.isFinite(refIdNum) ? refIdNum : null,
      from_employee_id:
        Number.isFinite(fromEmpIdNum) && fromEmpIdNum > 0 ? fromEmpIdNum : null,
      to_employee_id:
        Number.isFinite(toEmpIdNum) && toEmpIdNum > 0 ? toEmpIdNum : null,
      performed_by: row?.performedBy || null,
      remarks: row?.remarks || null,
      location_scope: row?.locationScope || null,
      metadata_json: row?.metadata || null,
    });
  }

  if (!payload.length) return [];
  return StockMovement.bulkCreate(payload, { transaction });
}

module.exports = {
  logStockMovement,
  logStockMovements,
};
