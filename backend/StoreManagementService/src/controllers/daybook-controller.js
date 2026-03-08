const { DayBookService } = require("../services/index");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const daybookService = new DayBookService();

const create = async (req, res) => {
  console.log("I m inside create function");
  try {
    console.log("I am inside try of create fucntion in controller");
    const { files, body } = req;
    console.log("req body:", req.body);
    // const data = {
    //   ...body,
    //   bill_image_url: files?.billImage?.[0]?.path || null,
    //   item_image_url: files?.itemImage?.[0]?.path || null,
    // };
    const data = {
      ...req.body, // no file logic needed here
    };
    console.log("Creating DayBook with data:", data);
    const daybook = await daybookService.createDayBook(data, req.user?.id || null);
    return res.status(201).json({
      data: daybook,
      success: true,
      message: "Successfully added a day book",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to create a day book",
      err: error,
    });
  }
};

const createFullDayBook = async (req, res) => {
  try {
    const result = await daybookService.createFullDayBook(
      req.body,
      req.user?.id || null,
    );
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create daybook",
    });
  }
};

const destroy = async (req, res) => {
  try {
    const response = await vendorService.deleteVendor(req.params.id);
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully deleted a vendor",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to delete vendor",
      err: error,
    });
  }
};

const getById = async (req, res) => {
  try {
    const response = await daybookService.getDayBookById(req.params.id);
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully fetched a daybook by id",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch a daybook by id",
      err: error,
    });
  }
};
const update = async (req, res) => {
  try {
    const response = await daybookService.updateDayBookNew(
      req.params.id,
      req.body,
    );
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully updated daybook record",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to update daybook record",
      err: error,
    });
  }
};

const getDayBookForMrn = async (req, res) => {
  try {
    const response = await daybookService.getDayBookForMrn({
      viewerUserId: req.user?.id || null,
      viewerRoles: Array.isArray(req.user?.roles) ? req.user.roles : [],
    });
    return res.status(200).json({
      data: response,
      success: true,
      message:
        "Successfully fetched all approved daybook to display in the MRN.",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch approved daybook to display in the MRN.",
      err: error,
    });
  }
};

const getAll = async (req, res) => {
  try {
    // Read optional query params from frontend: level and isStoreEntry
    const {
      level = null,
      isStoreEntry = "false",
      entryNo = "",
      finYear = null,
      status = null,
      entryType = null,
      page = null,
      limit = null,
      cursor = null,
      cursorMode = "false",
    } = req.query || {};

    // Normalize
    const lvl = level !== null && level !== "" ? parseInt(level, 10) : null;
    const isStoreEntryFlag = String(isStoreEntry).toLowerCase() === "true";
    const pageNum =
      page !== null && page !== "" && Number.isFinite(Number(page))
        ? parseInt(page, 10)
        : null;
    const limitNum =
      limit !== null && limit !== "" && Number.isFinite(Number(limit))
        ? parseInt(limit, 10)
        : null;
    const safePage = pageNum && pageNum > 0 ? pageNum : null;
    const safeLimit = limitNum && limitNum > 0 ? Math.min(limitNum, 500) : null;
    const safeCursor =
      cursor !== null && String(cursor).trim() !== "" ? String(cursor) : null;
    const useCursorMode = String(cursorMode).toLowerCase() === "true";

    console.log(
      "controller : level",
      lvl,
      isStoreEntryFlag,
      entryNo,
      finYear,
      status,
      entryType,
      safePage,
      safeLimit,
      safeCursor,
      useCursorMode,
    );

    // Use the filtered service so role-based visibility is enforced
    const response = await daybookService.getAllDayBooksByLevel({
      lvl,
      isStoreEntryFlag,
      entryNo,
      finYear,
      status,
      entryType,
      page: safePage,
      limit: safeLimit,
      cursor: safeCursor,
      cursorMode: useCursorMode,
      viewerUserId: req.user?.id || null,
      viewerRoles: Array.isArray(req.user?.roles) ? req.user.roles : [],
    });

    const rows = Array.isArray(response) ? response : response?.rows || [];
    const meta = Array.isArray(response) ? null : response?.meta || null;

    return res.status(200).json({
      data: rows,
      ...(meta ? { meta } : {}),
      success: true,
      message: "Successfully fetched daybook records",
      err: {},
    });
  } catch (error) {
    console.error("getAll daybooks error:", error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch daybook records",
      err: error,
    });
  }
};

// GET /api/v1/daybook/search?entryNo=123&level=1&isStoreEntry=false+// GET /api/v1/daybook/search?entryNo=123&level=1&isStoreEntry=false
const searchDayBookByEntryNo = async (req, res) => {
  try {
    // read raw query values
    const {
      entryNo = "",
      level = null,
      isStoreEntry = "false",
    } = req.query || {};

    // normalize types: level -> number|null, isStoreEntry -> boolean
    const lvl = level !== null && level !== "" ? parseInt(level, 10) : null;
    const storeFlag = String(isStoreEntry).toLowerCase() === "true";

    const records = await daybookService.searchDayBookByEntryNo(
      entryNo,
      lvl,
      storeFlag,
      {
        viewerUserId: req.user?.id || null,
        viewerRoles: Array.isArray(req.user?.roles) ? req.user.roles : [],
      },
    );
    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error("searchDayBookByEntryNo error:", error);
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : "Internal Server Error",
    });
  }
};

// PATCH /daybook/:id/approve  → go to next active stage
const approveDayBook = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await daybookService.advanceApprovalUsingStages(
      id,
      req.user?.id || null,
    );
    return res.status(200).json({
      success: true,
      data: updated,
      message: "DayBook moved to next approval level",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(400)
      .json({ success: false, error: error.message || "Approval failed" });
  }
};

// PATCH /daybook/:id/reject → send back to store (level 0)
const rejectDayBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks = null } = req.body || {};
    const updated = await daybookService.rejectToStore(id, remarks);
    return res.status(200).json({
      success: true,
      data: updated,
      message: "DayBook sent back to Store",
    });
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, error: error.message || "Reject failed" });
  }
};

const getLastEntryForType = async (req, res) => {
  const { entry_type, fin_year } = req.query;
  try {
    const response = await daybookService.getLastEntryForType(
      entry_type,
      fin_year,
    );
    return res.status(200).json({
      data: response,
      success: true,
      message: "Successfully fetched entry details",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch entry details",
      err: error,
    });
  }
};

const sendBack = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    // Reset approval stage to store
    await updateDayBook(id, {
      approval_level: 0,
      next_role: "STORE",
      status: "Rejected",
      remarks,
    });

    res.status(200).json({ message: "Sent back to store" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error sending back to store", error: error.message });
  }
};

const cancelMrn = async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmedNonSerialized } = req.body;

    const result = await daybookService.cancelMrn(id, confirmedNonSerialized);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("MRN Cancel Error:", error.message);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getDayBookFullDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await daybookService.getDayBookFullDetails(id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getDayBookFullDetails error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch DayBook details",
    });
  }
};

const getMrnWithFilters = async (req, res) => {
  try {
    const {
      search,
      finYear,
      status,
      entryType = null,
      page = null,
      limit = null,
      cursor = null,
      cursorMode = "false",
    } = req.query || {};

    const safePage =
      page != null && Number.isFinite(Number(page)) && Number(page) > 0
        ? Number(page)
        : null;
    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 100, 500)
        : null;
    const useCursorMode = parseCursorMode(cursorMode);

    const result = await daybookService.getMrnWithFilters({
      search,
      finYear,
      status,
      entryType,
      page: safePage,
      limit: safeLimit,
      cursor: cursor ? String(cursor) : null,
      cursorMode: useCursorMode,
      viewerUserId: req.user?.id || null,
      viewerRoles: Array.isArray(req.user?.roles) ? req.user.roles : [],
    });
    const data = Array.isArray(result) ? result : result?.rows || [];
    const meta = Array.isArray(result) ? null : result?.meta || null;

    return res.status(200).json({
      success: true,
      data,
      ...(meta ? { meta } : {}),
    });
  } catch (error) {
    console.error("getMrnWithFilters error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch MRN list",
    });
  }
};

module.exports = {
  create,
  destroy,
  update,
  getAll,
  getById,
  searchDayBookByEntryNo,
  getDayBookForMrn,
  getLastEntryForType,
  sendBack,
  approveDayBook,
  rejectDayBook,
  cancelMrn,
  getDayBookFullDetails,
  getMrnWithFilters,
  createFullDayBook,
};
