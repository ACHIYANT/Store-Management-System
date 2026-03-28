"use strict";

const fs = require("fs");
const XLSX = require("xlsx");
const {
  CategoryMasterMigrationService,
} = require("../services/category-master-migration-service");
const {
  buildMigrationMeta,
  resolveMigrationErrorStatus,
} = require("../utils/migration-api-utils");

const service = new CategoryMasterMigrationService();

const removeFileSafe = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete upload file:", error);
  }
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

const resolveSheetName = (workbook, preferred = "category_master") => {
  if (!preferred) return null;
  const exact = workbook.SheetNames.find((name) => name === preferred);
  if (exact) return exact;

  const lower = String(preferred).toLowerCase();
  return workbook.SheetNames.find((name) => name.toLowerCase() === lower) || null;
};

const buildRowsFromFile = (filePath, body = {}) => {
  const workbook = XLSX.readFile(filePath);
  const preferredSheet = body.sheetName || "category_master";
  const sheetName = resolveSheetName(workbook, preferredSheet);

  if (!sheetName) {
    throw new Error(
      `Sheet '${preferredSheet}' not found. Available sheets: ${workbook.SheetNames.join(", ")}`,
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  const rows = rawRows.map((row, idx) => ({
    ...row,
    row_no: row?.row_no || idx + 2,
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
    const payload = buildRowsFromFile(uploadedFile.path, req.body || {});
    if (!payload.rows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
        data: {},
        err: {},
      });
    }

    const result = await service.validate({ rows: payload.rows });
    return res.status(200).json({
      success: true,
      message: "Category master migration validation completed",
      data: {
        ...result,
        meta: buildMigrationMeta(payload.meta, req.user || {}),
      },
      err: {},
    });
  } catch (error) {
    console.error("Category master migration validation error:", error);
    return res.status(resolveMigrationErrorStatus(error)).json({
      success: false,
      message: "Category master migration validation failed",
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
    const payload = buildRowsFromFile(uploadedFile.path, req.body || {});
    if (!payload.rows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
        data: {},
        err: {},
      });
    }

    const result = await service.execute({ rows: payload.rows });
    return res.status(200).json({
      success: true,
      message: "Category master migration execution completed",
      data: {
        ...result,
        meta: buildMigrationMeta(payload.meta, req.user || {}),
      },
      err: {},
    });
  } catch (error) {
    console.error("Category master migration execute error:", error);
    return res.status(resolveMigrationErrorStatus(error)).json({
      success: false,
      message: "Category master migration execution failed",
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
