// controllers/issueditem-controller.js
const { IssuedItemService } = require("../services/index");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");
const { normalizeSkuUnit } = require("../utils/sku-units");

const service = new IssuedItemService();

/**
 * POST /issue
 * Body (non-serialized): { stockId, employeeId, quantity }
 * Body (serialized):     { stockId, employeeId, assetIds: [<assetId>...] }
 */

const parseMaybe = (v, fallback = []) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v || "[]");
    } catch {
      return fallback;
    }
  }
  return v || fallback;
};
const num = (x) => (x === "" || x == null ? undefined : Number(x));
const parseSkuUnit = (value) =>
  value === undefined || value === null || String(value).trim() === ""
    ? null
    : normalizeSkuUnit(value);
const issue = async (req, res) => {
  try {
    const { stockId, employeeId, quantity, assetIds, skuUnit, sku_unit } = req.body;
    const normalizedSkuUnit = parseSkuUnit(skuUnit ?? sku_unit);

    if (!stockId || !employeeId) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "stockId and employeeId are required",
        err: {},
      });
    }

    let data;
    if (Array.isArray(assetIds) && assetIds.length > 0) {
      // serialized flow
      data = await service.issueSerialized({
        stockId,
        employeeId,
        assetIds,
        skuUnit: normalizedSkuUnit,
      });
    } else {
      // non-serialized flow
      if (!quantity) {
        return res.status(400).json({
          data: {},
          success: false,
          message: "quantity is required when assetIds are not provided",
          err: {},
        });
      }
      data = await service.issueItem({
        stockId,
        employeeId,
        quantity,
        skuUnit: normalizedSkuUnit,
      });
    }

    return res.status(201).json({
      data,
      success: true,
      message: "Issued successfully",
      err: {},
    });
  } catch (error) {
    console.error("IssuedItemController.issue error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Issuance failed",
      err: error,
    });
  }
};

async function listAll(req, res) {
  try {
    const { employeeId, stockId, categoryId } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 200;
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;

    const { rows, total } = await service.listAll({
      employeeId,
      stockId,
      categoryId,
      limit,
      page,
    });

    return res.status(200).json({
      success: true,
      message: "Issued items fetched successfully",
      data: rows,
      total,
    });
  } catch (error) {
    console.error("Error in issuedItemController.listAll:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch issued items",
      data: [],
      total: 0,
      err: error,
    });
  }
}

async function search(req, res) {
  try {
    const {
      page = 1,
      limit = 50,
      cursor = null,
      cursorMode = "false",
      currentOnly = "false",
      search,
      employeeId,
      categoryId,
      itemType, // Asset | Consumable
      fromDate,
      toDate,
    } = req.query;

    const safeLimit = normalizeLimit(limit, 50, 500);
    const useCursorMode = parseCursorMode(cursorMode);
    const useCurrentOnly = parseCursorMode(currentOnly);

    const result = await service.search({
      page: Number(page),
      limit: safeLimit,
      cursor: cursor ? String(cursor) : null,
      cursorMode: useCursorMode,
      currentOnly: useCurrentOnly,
      search,
      employeeId,
      categoryId,
      itemType,
      fromDate,
      toDate,
    });

    const meta = result?.meta
      ? result.meta
      : {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
          mode: "offset",
        };

    return res.json({
      success: true,
      data: result.rows,
      meta,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, data: [], meta: {} });
  }
}

const issueBulk = async (req, res) => {
  try {
    // Works for both JSON and multipart
    const employeeId = num(req.body.employeeId);
    const requisitionId = num(req.body.requisitionId);

    // When multipart, these are strings -> parse
    let items = parseMaybe(req.body.items);
    let serializedItems = parseMaybe(req.body.serializedItems);

    // Coerce to numbers
    items = (items || []).map((it) => ({
      stockId: num(it?.stockId),
      quantity: num(it?.quantity),
      sku_unit: parseSkuUnit(it?.sku_unit ?? it?.skuUnit),
      requisition_item_id: num(it?.requisition_item_id),
    }));

    serializedItems = (serializedItems || []).map((s) => ({
      stockId: num(s?.stockId),
      assetIds: Array.isArray(s?.assetIds) ? s.assetIds.map(num) : [],
      sku_unit: parseSkuUnit(s?.sku_unit ?? s?.skuUnit),
      requisition_item_id: num(s?.requisition_item_id),
    }));

    if (!employeeId) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "employeeId is required",
        err: {},
      });
    }

    // Important: only validate non-serialized lines that actually exist
    const bad = items.find((it) => !it.stockId || !it.quantity);
    if (bad) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "stockId and quantity required for items[]",
        err: {},
      });
    }

    const requisitionUrl = req.encryptedFileUrl || null; // set by upload middleware
    const notes = req.body.notes || null;

    const data = await service.issueMany({
      employeeId,
      items,
      serializedItems,
      notes,
      requisitionUrl,
      requisitionId,
      actor: req.user || null,
    });

    return res.status(201).json({
      data,
      success: true,
      message: "Issued in bulk successfully",
      err: {},
    });
  } catch (e) {
    console.error("issueBulk error:", e);
    const statusCode =
      e?.name === "SequelizeForeignKeyConstraintError" ||
      e?.name === "SequelizeValidationError" ||
      e?.message?.includes("requisition") ||
      e?.message?.includes("stockId") ||
      e?.message?.includes("assetIds")
        ? 400
        : 500;
    return res.status(statusCode).json({
      data: {},
      success: false,
      message: e.message || "Bulk Issuance Failed",
      err: e,
    });
  }
};

module.exports = { issue, issueBulk, search };
