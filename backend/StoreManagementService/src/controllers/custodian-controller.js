const { CustodianService } = require("../services/index");
const { normalizeLimit, parseCursorMode } = require("../utils/cursor-pagination");

const service = new CustodianService();
const parseBoolean = (value, fallback = null) => {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(text)) return true;
  if (["0", "false", "no", "n"].includes(text)) return false;
  return fallback;
};

const getCreateStatusCode = (error, message) => {
  if (error?.name === "SequelizeUniqueConstraintError") return 409;
  if (/required|invalid|mismatch|not found/i.test(message || "")) return 400;
  return 500;
};

const create = async (req, res) => {
  try {
    const data = await service.create(req.body || {});
    return res.status(201).json({
      data,
      success: true,
      message: "Custodian created",
      err: {},
    });
  } catch (error) {
    const message =
      error?.error?.message || error?.message || "Failed to create custodian";
    const statusCode = getCreateStatusCode(error?.error || error, message);
    return res.status(statusCode).json({
      data: {},
      success: false,
      message,
      err: error,
    });
  }
};

const get = async (req, res) => {
  try {
    const data = await service.getById(req.params.id);
    if (!data) {
      return res.status(404).json({
        data: {},
        success: false,
        message: "Custodian not found",
        err: {},
      });
    }
    return res.status(200).json({
      data,
      success: true,
      message: "Custodian fetched",
      err: {},
    });
  } catch (error) {
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch custodian",
      err: error,
    });
  }
};

const list = async (req, res) => {
  try {
    const {
      search = "",
      custodian_type = "",
      location = "",
      is_active = "",
      include_inactive = "false",
      page = null,
      limit = null,
      cursorMode = "false",
    } = req.query || {};

    const useCursorMode = parseCursorMode(cursorMode);
    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 50, 500)
        : null;
    const safePage =
      page != null && Number.isFinite(Number(page)) && Number(page) > 0
        ? Number(page)
        : null;
    const includeInactive = parseBoolean(include_inactive, false);
    const resolvedIsActive = includeInactive
      ? null
      : parseBoolean(is_active, true);

    if (useCursorMode) {
      return res.status(400).json({
        data: [],
        success: false,
        message: "Cursor mode not supported for custodians",
        err: {},
      });
    }

    const response = await service.list({
      search,
      custodian_type,
      location,
      is_active: resolvedIsActive,
      page: safePage,
      limit: safeLimit,
    });

    const rows = Array.isArray(response) ? response : response?.rows || [];
    const meta = Array.isArray(response) ? null : response?.count != null
      ? {
          page: safePage || 1,
          limit: safeLimit || rows.length,
          total: response.count,
          totalPages:
            safeLimit && safeLimit > 0
              ? Math.ceil(response.count / safeLimit)
              : 1,
          mode: "offset",
        }
      : null;

    return res.status(200).json({
      data: rows,
      ...(meta ? { meta } : {}),
      success: true,
      message: "Custodians fetched",
      err: {},
    });
  } catch (error) {
    return res.status(500).json({
      data: [],
      success: false,
      message: "Failed to fetch custodians",
      err: error,
    });
  }
};

module.exports = {
  create,
  get,
  list,
};
