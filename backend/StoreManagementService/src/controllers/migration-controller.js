const XLSX = require("xlsx");
const fs = require("fs");
const { MigrationService } = require("../services/migration-service");

const service = new MigrationService();

const removeFileSafe = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete upload file:", error);
  }
};

const RESERVED_SHEETS = new Set([
  "instructions",
  "category_master",
  "_validations",
]);

const REQUIRED_COLUMNS = [
  "item_name",
  "category_name",
  "quantity",
  "sku_unit",
  "purchased_at",
  "warranty_expiry",
];

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const hasRequiredColumns = (sheet) => {
  if (!sheet || !sheet["!ref"]) return false;
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, header: 1 });
  const headerRow = Array.isArray(rows?.[0]) ? rows[0] : [];
  const headerSet = new Set(headerRow.map(normalizeHeader).filter(Boolean));
  return REQUIRED_COLUMNS.every((col) => headerSet.has(col));
};

const findSheetCaseInsensitive = (sheetNames = [], wanted = "") => {
  const exact = sheetNames.find((name) => name === wanted);
  if (exact) return exact;
  const lower = String(wanted).toLowerCase();
  return sheetNames.find((name) => name.toLowerCase() === lower) || null;
};

const resolveSheetName = (workbook, preferred = "opening_stock") => {
  const sheetNames = workbook.SheetNames || [];

  // 1) Preferred sheet (if explicitly sent) only when it has required headers
  if (preferred) {
    const preferredMatch = findSheetCaseInsensitive(sheetNames, preferred);
    if (
      preferredMatch &&
      !RESERVED_SHEETS.has(preferredMatch.toLowerCase()) &&
      hasRequiredColumns(workbook.Sheets[preferredMatch])
    ) {
      return preferredMatch;
    }
  }

  // 2) Strong default: opening_stock
  const openingMatch = findSheetCaseInsensitive(sheetNames, "opening_stock");
  if (openingMatch && hasRequiredColumns(workbook.Sheets[openingMatch])) {
    return openingMatch;
  }

  // 3) First non-reserved sheet with required headers
  for (const name of sheetNames) {
    if (RESERVED_SHEETS.has(String(name).toLowerCase())) continue;
    if (hasRequiredColumns(workbook.Sheets[name])) return name;
  }

  return null;
};

const buildRowsFromFile = (filePath, body = {}) => {
  const workbook = XLSX.readFile(filePath);
  const preferredSheet = body.sheetName || "opening_stock";
  const sheetName = resolveSheetName(workbook, preferredSheet);

  if (!sheetName) {
    throw new Error(
      `No valid opening stock sheet found. Required columns: ${REQUIRED_COLUMNS.join(", ")}. Available sheets: ${workbook.SheetNames.join(", ")}`,
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const rows = rawRows.map((row, index) => ({
    ...row,
    __row_no: index + 2,
  }));

  return {
    rows,
    meta: {
      workbookSheets: workbook.SheetNames,
      sheetName,
      parsedRows: rows.length,
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

const validateMigrationFile = async (req, res) => {
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
    const payload = buildRowsFromFile(uploadedFile.path, req.body || {});
    if (!payload.rows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
        data: {},
        err: {},
      });
    }

    const result = await service.validate(payload.rows);
    return res.status(200).json({
      success: true,
      message: "Opening stock migration validation completed",
      data: {
        ...result,
        meta: payload.meta,
      },
      err: {},
    });
  } catch (err) {
    console.error("Opening stock migration validation error:", err);
    return res.status(500).json({
      success: false,
      message: "Opening stock migration validation failed",
      data: {},
      err: { message: err.message || "Unknown error" },
    });
  } finally {
    removeFileSafe(uploadedFile.path);
  }
};

const executeMigrationFile = async (req, res) => {
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
    const payload = buildRowsFromFile(uploadedFile.path, req.body || {});
    if (!payload.rows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
        data: {},
        err: {},
      });
    }

    const result = await service.execute(payload.rows);
    return res.status(200).json({
      success: true,
      message: "Opening stock migration executed",
      data: {
        ...result,
        meta: payload.meta,
      },
      err: {},
    });
  } catch (err) {
    console.error("Opening stock migration execute error:", err);
    return res.status(500).json({
      success: false,
      message: "Opening stock migration execution failed",
      data: {},
      err: { message: err.message || "Unknown error" },
    });
  } finally {
    removeFileSafe(uploadedFile.path);
  }
};

module.exports = {
  uploadMigrationFile: executeMigrationFile,
  validateMigrationFile,
  executeMigrationFile,
};
