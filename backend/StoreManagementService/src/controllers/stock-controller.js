const StockService = require("../services/stock-service");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const stockService = new StockService();

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
  if (["0", "false", "no", "n", "off"].includes(raw)) return false;
  return fallback;
};

const parseStockSource = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim().toUpperCase();
  if (raw === "DAYBOOK" || raw === "MIGRATION") return raw;
  return null;
};
// Endpoint to move approved DayBookItems to stock
const moveDayBookItemsToStock = async (req, res) => {
  try {
    const { daybookId } = req.params; // Get daybookId from the route parameter

    // Call the service to move items to stock
    const stocks = await stockService.moveDayBookItemsToStock(
      daybookId,
      null,
      req.user || null,
    );

    // Return response
    return res.status(200).json({
      success: true,
      message: "DayBookItems successfully moved to Stock",
      data: stocks,
    });
  } catch (error) {
    console.error("Error in StockController:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: "Error moving DayBookItems to Stock",
      error: error.message,
    });
  }
};
const getAll = async (req, res) => {
  try {
    const data = await stockService.getAll(req.user || null);
    return res.status(200).json({
      data,
      success: true,
      message: "Successfully fetched stocks",
      err: {},
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      data: {},
      success: false,
      message: "Failed to fetch stocks",
      err: error,
    });
  }
};

const getAllStocksByCategory = async (req, res) => {
  try {
    const {
      search = "",
      categoryHeadId = null,
      categoryGroupId = null,
      stockLevel = null,
      source = null,
      limit = null,
      cursor = null,
      cursorMode = "false",
    } = req.query;

    const useCursorMode = parseCursorMode(cursorMode);
    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 100, 500)
        : null;

    const data = await stockService.getAllStocksByCategory(
      {
        search,
        categoryHeadId,
        categoryGroupId,
        stockLevel,
        source: parseStockSource(source),
        limit: safeLimit,
        cursor: cursor ? String(cursor) : null,
        cursorMode: useCursorMode,
      },
      req.user || null,
    );

    const rows = Array.isArray(data) ? data : data?.rows || [];
    const meta = Array.isArray(data) ? null : data?.meta || null;

    return res.status(200).json({
      success: true,
      data: rows,
      ...(meta ? { meta } : {}),
      message: "Stocks fetched successfully",
      err: {},
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      data: {},
      message: "Failed to fetch stocks",
      err: error.message,
    });
  }
};

const getStocksByCategoryId = async (req, res) => {
  try {
    const {
      search = "",
      stockLevel = null,
      limit = null,
      cursor = null,
      cursorMode = "false",
      onlyInStock = "false",
      groupByMaster = "false",
      source = null,
    } = req.query;

    const useCursorMode = parseCursorMode(cursorMode);
    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 100, 500)
        : null;

    const response = await stockService.getStocksByCategoryId(
      req.params.id,
      {
        search,
        stockLevel,
        onlyInStock: parseBoolean(onlyInStock, false),
        groupByMaster: parseBoolean(groupByMaster, false),
        source: parseStockSource(source),
        limit: safeLimit,
        cursor: cursor ? String(cursor) : null,
        cursorMode: useCursorMode,
      },
      req.user || null,
    );
    const rows = Array.isArray(response) ? response : response?.rows || [];
    const meta = Array.isArray(response) ? null : response?.meta || null;

    return res.status(200).json({
      success: true,
      data: rows,
      ...(meta ? { meta } : {}),
      message: "Stocks fetched successfully",
      err: {},
    });
  } catch (error) {
    console.error("StockController.getStocksByCategoryId error:", {
      message: error?.message,
      sqlMessage: error?.parent?.sqlMessage,
      code: error?.parent?.code,
      errno: error?.parent?.errno,
      sqlState: error?.parent?.sqlState,
      sql: error?.sql,
    });
    return res.status(error?.statusCode || 500).json({
      success: false,
      data: {},
      message: "Failed to fetch stock items",
      err: {
        message: error?.message,
        sqlMessage: error?.parent?.sqlMessage,
        code: error?.parent?.code,
        sqlState: error?.parent?.sqlState,
      },
    });
  }
};

const getOutOfStockReport = async (req, res) => {
  try {
    const data = await stockService.getOutOfStockReport(req.user || null);
    return res.status(200).json({
      success: true,
      data,
      message: "Out of stock report fetched successfully",
      err: {},
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      data: {},
      message: "Failed to fetch out of stock report",
      err: error?.message || error,
    });
  }
};

module.exports = {
  getAll,
  moveDayBookItemsToStock,
  getAllStocksByCategory,
  getStocksByCategoryId,
  getOutOfStockReport,
};
