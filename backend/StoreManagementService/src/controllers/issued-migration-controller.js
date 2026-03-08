"use strict";

const fs = require("fs");
const XLSX = require("xlsx");
const { IssuedMigrationService } = require("../services/issued-migration-service");

const service = new IssuedMigrationService();

const removeFileSafe = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete upload file:", error);
  }
};

const resolveSheetName = (workbook, preferred) => {
  if (!preferred) return null;
  const exact = workbook.SheetNames.find((name) => name === preferred);
  if (exact) return exact;

  const lower = String(preferred).toLowerCase();
  return workbook.SheetNames.find((name) => name.toLowerCase() === lower) || null;
};

const readRows = (workbook, sheetName) => {
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
};

const toInteger = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Number.isInteger(num) ? num : null;
};

const toText = (value) => {
  if (value === undefined || value === null) return null;
  const clean = String(value).trim();
  return clean || null;
};

const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== "";

const parseItemType = (value) => {
  if (!hasValue(value)) return null;
  const raw = String(value).trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (["asset", "assets", "serialized", "serialised"].includes(raw)) {
    return "serialized";
  }
  if (
    ["consumable", "consumables", "nonserialized", "nonserialised"].includes(raw)
  ) {
    return "consumable";
  }
  return null;
};

const splitUnifiedRows = (rawRows = [], sheetName = "issued_items") => {
  const assetsRows = [];
  const consumableRows = [];
  const context = {
    employee_emp_id: null,
    employee_name: null,
    division: null,
  };

  let employeeHeaderRows = 0;
  let inferredTypeRows = 0;

  const normalizeKey = (key) => IssuedMigrationService.normalizeKey(key);

  for (let index = 0; index < (rawRows || []).length; index += 1) {
    const rowNo = index + 2;
    const source = rawRows[index] || {};
    const row = {};

    Object.entries(source).forEach(([key, value]) => {
      row[normalizeKey(key)] = value;
    });

    const get = (...aliases) => {
      for (const alias of aliases) {
        const value = row[normalizeKey(alias)];
        if (value !== undefined) return value;
      }
      return null;
    };

    const rowEmpId = toInteger(get("employee_emp_id", "employee_id", "emp_id"));
    const rowEmpName = toText(get("employee_name", "name"));
    const rowDivision = toText(get("division"));

    if (rowEmpId) context.employee_emp_id = rowEmpId;
    if (rowEmpName) context.employee_name = rowEmpName;
    if (rowDivision) context.division = rowDivision;

    const hasItemData =
      hasValue(get("item_type", "type", "entry_type")) ||
      hasValue(get("item_master_id", "master_id", "item_code", "item_master_code")) ||
      hasValue(get("stock_id")) ||
      hasValue(get("item_name", "stock_name")) ||
      hasValue(get("category_id", "item_category_id", "category_name", "item_category_name")) ||
      hasValue(get("serial_number", "serial_no", "asset_tag")) ||
      hasValue(get("quantity", "qty"));

    if (!hasItemData) {
      if (rowEmpId || rowEmpName || rowDivision) {
        employeeHeaderRows += 1;
      }
      continue;
    }

    const enriched = {
      ...source,
      row_no: rowNo,
      sheet_name: sheetName,
      employee_emp_id:
        rowEmpId || context.employee_emp_id || get("employee_emp_id", "employee_id", "emp_id"),
      employee_name:
        rowEmpName || context.employee_name || get("employee_name", "name"),
      division: rowDivision || context.division || get("division"),
    };

    let itemType = parseItemType(get("item_type", "type", "entry_type"));
    if (!itemType) {
      const hasSerial =
        hasValue(get("serial_number", "serial_no")) || hasValue(get("asset_tag"));
      itemType = hasSerial ? "serialized" : "consumable";
      inferredTypeRows += 1;
    }

    enriched.item_type = itemType === "serialized" ? "Asset" : "Consumable";

    if (itemType === "serialized") assetsRows.push(enriched);
    else consumableRows.push(enriched);
  }

  return {
    assetsRows,
    consumableRows,
    stats: {
      employeeHeaderRows,
      inferredTypeRows,
      parsedRows: assetsRows.length + consumableRows.length,
    },
  };
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
  if (["0", "false", "no", "n", "off"].includes(raw)) return false;
  return fallback;
};

const buildPayloadFromFile = (filePath, body = {}) => {
  const workbook = XLSX.readFile(filePath);

  const singleSheetName = resolveSheetName(
    workbook,
    body.sheetName || body.itemsSheetName || "issued_items",
  );

  if (singleSheetName) {
    const unifiedRows = readRows(workbook, singleSheetName);
    const split = splitUnifiedRows(unifiedRows, singleSheetName);

    return {
      assetsRows: split.assetsRows,
      consumableRows: split.consumableRows,
      sheetLabels: {
        serialized: singleSheetName,
        consumable: singleSheetName,
      },
      options: {
        adjustStock: parseBoolean(body.adjustStock, false),
        createStockIfMissing: parseBoolean(body.createStockIfMissing, true),
      },
      meta: {
        workbookSheets: workbook.SheetNames,
        format: "single_sheet",
        itemsSheetName: singleSheetName,
        parsedRows: split.stats.parsedRows,
        employeeHeaderRows: split.stats.employeeHeaderRows,
        inferredTypeRows: split.stats.inferredTypeRows,
      },
    };
  }

  const assetsSheetName =
    resolveSheetName(workbook, body.assetsSheetName || "assets_issued") ||
    workbook.SheetNames[0];
  const consumablesSheetName = resolveSheetName(
    workbook,
    body.consumablesSheetName || "consumables_issued",
  );

  const assetsRows = readRows(workbook, assetsSheetName);
  const consumableRows = readRows(workbook, consumablesSheetName);

  return {
    assetsRows,
    consumableRows,
    sheetLabels: {
      serialized: assetsSheetName || "assets_issued",
      consumable: consumablesSheetName || "consumables_issued",
    },
    options: {
      adjustStock: parseBoolean(body.adjustStock, false),
      createStockIfMissing: parseBoolean(body.createStockIfMissing, true),
    },
    meta: {
      workbookSheets: workbook.SheetNames,
      format: "legacy_two_sheet",
      assetsSheetName,
      consumablesSheetName,
    },
  };
};

const ensureMigrationEnabled = (res) => {
  if (process.env.ENABLE_MIGRATION !== "true") {
    res.status(403).json({
      success: false,
      message: "Migration disabled",
      data: {},
      err: {},
    });
    return false;
  }
  return true;
};

const extractUploadedFile = (req) => {
  if (req?.file?.path) return req.file;

  if (Array.isArray(req?.files) && req.files.length > 0) {
    return req.files.find((f) => f?.path) || null;
  }

  if (req?.files && typeof req.files === "object") {
    for (const value of Object.values(req.files)) {
      if (Array.isArray(value) && value.length > 0) {
        const file = value.find((f) => f?.path);
        if (file) return file;
      }
    }
  }

  return null;
};

async function validateUpload(req, res) {
  if (!ensureMigrationEnabled(res)) return;
  const uploadedFile = extractUploadedFile(req);

  if (!uploadedFile?.path) {
    return res.status(400).json({
      success: false,
      message: "file is required",
      data: {},
      err: {},
    });
  }

  try {
    const payload = buildPayloadFromFile(uploadedFile.path, req.body || {});
    if (!payload.assetsRows.length && !payload.consumableRows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
        data: {},
        err: {},
      });
    }

    const result = await service.validate(payload);
    return res.status(200).json({
      success: true,
      message: "Issued migration validation completed",
      data: {
        ...result,
        meta: payload.meta,
      },
      err: {},
    });
  } catch (error) {
    console.error("Issued migration validation error:", error);
    return res.status(500).json({
      success: false,
      message: "Issued migration validation failed",
      data: {},
      err: { message: error.message || "Unknown error" },
    });
  } finally {
    removeFileSafe(uploadedFile.path);
  }
}

async function executeUpload(req, res) {
  if (!ensureMigrationEnabled(res)) return;
  const uploadedFile = extractUploadedFile(req);

  if (!uploadedFile?.path) {
    return res.status(400).json({
      success: false,
      message: "file is required",
      data: {},
      err: {},
    });
  }

  try {
    const payload = buildPayloadFromFile(uploadedFile.path, req.body || {});
    if (!payload.assetsRows.length && !payload.consumableRows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
        data: {},
        err: {},
      });
    }

    const result = await service.execute(payload);
    return res.status(200).json({
      success: true,
      message: "Issued migration execution completed",
      data: {
        ...result,
        meta: payload.meta,
      },
      err: {},
    });
  } catch (error) {
    console.error("Issued migration execution error:", error);
    return res.status(500).json({
      success: false,
      message: "Issued migration execution failed",
      data: {},
      err: { message: error.message || "Unknown error" },
    });
  } finally {
    removeFileSafe(uploadedFile.path);
  }
}

module.exports = {
  validateUpload,
  executeUpload,
};
