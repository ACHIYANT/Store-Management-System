// controllers/assetevent-controller.js
const { AssetEventService } = require("../services/index");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");
const service = new AssetEventService();

const create = async (req, res) => {
  try {
    const data = await service.create(req.body);
    return res.status(201).json({
      data,
      success: true,
      message: "Asset event created",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.create error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to create asset event",
      err: error,
    });
  }
};

const bulkCreate = async (req, res) => {
  try {
    const data = await service.bulkCreate(req.body); // expects array of events
    return res.status(201).json({
      data,
      success: true,
      message: "Asset events created",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.bulkCreate error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to bulk create asset events",
      err: error,
    });
  }
};

const getByAssetId = async (req, res) => {
  try {
    const data = await service.getByAssetId(req.params.assetId);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched events by asset",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.getByAssetId error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch events by asset",
      err: error,
    });
  }
};

const getTimeline = async (req, res) => {
  try {
    const data = await service.getTimeline(req.params.assetId);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched timeline",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.getTimeline error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch timeline",
      err: error,
    });
  }
};

const getByDayBookId = async (req, res) => {
  try {
    const data = await service.getByDayBookId(req.params.daybookId);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched events by daybook",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.getByDayBookId error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch events by daybook",
      err: error,
    });
  }
};

const getByIssuedItemId = async (req, res) => {
  try {
    const data = await service.getByIssuedItemId(req.params.issuedItemId);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched events by issued item",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.getByIssuedItemId error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch events by issued item",
      err: error,
    });
  }
};

const getByEmployeeHistory = async (req, res) => {
  try {
    const data = await service.getByEmployeeHistory(req.params.employeeId);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched events by employee",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.getByEmployeeHistory error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch events by employee",
      err: error,
    });
  }
};

const recent = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const data = await service.recent(limit);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched recent events",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.recent error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch recent events",
      err: error,
    });
  }
};

const search = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      cursor = null,
      cursorMode = "false",
      search,
      eventType,
      assetId,
      fromEmployeeId,
      toEmployeeId,
      daybookId,
      issuedItemId,
      fromDate,
      toDate,
    } = req.query;

    const safeLimit = normalizeLimit(limit, 50, 500);
    const useCursorMode = parseCursorMode(cursorMode);

    const result = await service.search({
      page: Number(page),
      limit: safeLimit,
      cursor: cursor ? String(cursor) : null,
      cursorMode: useCursorMode,
      search,
      eventType,
      assetId,
      fromEmployeeId,
      toEmployeeId,
      daybookId,
      issuedItemId,
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

    return res.status(200).json({
      success: true,
      data: result.rows,
      meta,
      message: "Fetched asset events",
      err: {},
    });
  } catch (error) {
    console.error("AssetEventController.search error:", error);
    return res.status(500).json({
      success: false,
      data: [],
      meta: {},
      message: "Failed to search asset events",
      err: error,
    });
  }
};

module.exports = {
  create,
  bulkCreate,
  getByAssetId,
  getTimeline,
  getByDayBookId,
  getByIssuedItemId,
  getByEmployeeHistory,
  recent,
  search,
};
