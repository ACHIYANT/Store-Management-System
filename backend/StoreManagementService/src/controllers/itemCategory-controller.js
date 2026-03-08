const { ItemCategoryService } = require("../services/index");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const itemCategoryService = new ItemCategoryService();

const create = async (req, res) => {
  console.log("I m inside create function");
  try {
    console.log("I am inside try of create fucntion in controller");
    const itemCategory = await itemCategoryService.createItemCategory(req.body);
    return res.status(201).json({
      data: itemCategory,
      success: true,
      message: "Successfully added a item category",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to create a item category",
      err: error,
    });
  }
};

const destroy = async (req, res) => {
  try {
    const response = await itemCategoryService.deleteItemCategory(
      req.params.id,
    );
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully deleted a item category",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to delete item category",
      err: error,
    });
  }
};

const get = async (req, res) => {
  try {
    const response = await itemCategoryService.getAllItemCategory(
      req.params.id,
    );
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully fetched all item categories",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch item categories",
      err: error,
    });
  }
};

const getById = async (req, res) => {
  try {
    const response = await itemCategoryService.getItemCategoryById(
      req.params.id,
    );
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully fetched a item category by Id",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch item category by Id",
      err: error,
    });
  }
};
const update = async (req, res) => {
  try {
    const response = await itemCategoryService.updateItemCategory(
      req.params.id,
      req.body,
    );
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully updated a item category",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to update a item category",
      err: error,
    });
  }
};

const getAll = async (req, res) => {
  try {
    const { page = null, limit = null } = req.query || {};
    const safePage =
      page != null && Number.isFinite(Number(page)) && Number(page) > 0
        ? Number(page)
        : null;
    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 100, 500)
        : null;

    const response = await itemCategoryService.getAllItemCategory({
      page: safePage,
      limit: safeLimit,
    });
    const rows = Array.isArray(response) ? response : response?.rows || [];
    const meta = Array.isArray(response) ? null : response?.meta || null;

    return res.status(200).json({
      data: rows,
      ...(meta ? { meta } : {}),
      success: true,
      message: "Successfully updated all item categories",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch all item categories",
      err: error,
    });
  }
};
const filter = async (req, res) => {
  try {
    const {
      category_name = "",
      serialized_required = "",
      head_id = "",
      group_id = "",
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

    const result = await itemCategoryService.filterItemCategories({
      category_name,
      serialized_required,
      head_id,
      group_id,
      page: safePage,
      limit: safeLimit,
      cursor: cursor ? String(cursor) : null,
      cursorMode: useCursorMode,
    });
    const rows = Array.isArray(result) ? result : result?.rows || [];
    const meta = Array.isArray(result) ? null : result?.meta || null;

    return res.status(200).json({
      success: true,
      data: rows,
      ...(meta ? { meta } : {}),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
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
  filter,
};
