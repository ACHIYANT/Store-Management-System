const { VendorService } = require("../services/index");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const vendorService = new VendorService();

const create = async (req, res) => {
  console.log("I m inside create function");
  try {
    console.log("I am inside try of create fucntion in controller");
    const vendor = await vendorService.createVendor(req.body);
    return res.status(201).json({
      data: vendor,
      success: true,
      message: "Successfully added a vendor",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to create a vendor",
      err: error,
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

const get = async (req, res) => {
  try {
    const response = await vendorService.getVendor(req.params.id);
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully fetched a vendor",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch vendor",
      err: error,
    });
  }
};


const getById = async (req, res) => {
  try {
    const response = await vendorService.getVendorById(req.params.id);
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully fetched a vendor by Id",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch vendor by Id",
      err: error,
    });
  }
};
const update = async (req, res) => {
  try {
    const response = await vendorService.updateVendor(req.params.id, req.body);
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully updated a vendor",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to update a vendor",
      err: error,
    });
  }
};

const getAll = async (req, res) => {
  try {
    const {
      search = "",
      page = null,
      limit = null,
      cursor = null,
      cursorMode = "false",
    } = req.query || {};

    const useCursorMode = parseCursorMode(cursorMode);
    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 100, 500)
        : null;
    const safePage =
      page != null && Number.isFinite(Number(page)) && Number(page) > 0
        ? Number(page)
        : null;

    const response = await vendorService.getAllVendors({
      search,
      page: safePage,
      limit: safeLimit,
      cursor: cursor ? String(cursor) : null,
      cursorMode: useCursorMode,
    });

    const rows = Array.isArray(response) ? response : response?.rows || [];
    const meta = Array.isArray(response) ? null : response?.meta || null;

    return res.status(200).json({
      data: rows,
      ...(meta ? { meta } : {}),
      success: true,
      message: "Successfully fetched vendors",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch all vendors",
      err: error,
    });
  }
};

const searchVendorByName = async (req, res) => {
  try {
    const {
      name = "",
      page = null,
      limit = null,
      cursor = null,
      cursorMode = "false",
    } = req.query || {};

    const useCursorMode = parseCursorMode(cursorMode);
    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 100, 500)
        : null;
    const safePage =
      page != null && Number.isFinite(Number(page)) && Number(page) > 0
        ? Number(page)
        : null;

    const response = await vendorService.searchVendorByName(name, {
      page: safePage,
      limit: safeLimit,
      cursor: cursor ? String(cursor) : null,
      cursorMode: useCursorMode,
    });
    const rows = Array.isArray(response) ? response : response?.rows || [];
    const meta = Array.isArray(response) ? null : response?.meta || null;

    return res.status(200).json({
      data: rows,
      ...(meta ? { meta } : {}),
      success: true,
      message: "Successfully fetched vendors matching the name",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to search vendors",
      err: error,
    });
  }
};

module.exports = {
  create,
  destroy,
  get,
  update,
  getAll,
  getById,
  searchVendorByName,
};
