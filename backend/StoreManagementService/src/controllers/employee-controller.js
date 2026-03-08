const { EmployeeService } = require("../services/index");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

const employeeService = new EmployeeService();

const create = async (req, res) => {
  console.log("I m inside create function", req.body);
  try {
    console.log("I am inside try of create fucntion in controller");
    const employee = await employeeService.createEmployee(req.body);
    return res.status(201).json({
      data: employee,
      success: true,
      message: "Successfully added a employee",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to create a employee",
      err: error,
    });
  }
};

const destroy = async (req, res) => {
  try {
    const response = await employeeService.deleteEmployee(req.params.id);
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully deleted a employee",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to delete employee",
      err: error,
    });
  }
};

const get = async (req, res) => {
  try {
    const response = await employeeService.getEmployee(req.params.id);
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully fetched a employee",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch employee",
      err: error,
    });
  }
};
const update = async (req, res) => {
  try {
    const response = await employeeService.updateEmployee(
      req.params.id,
      req.body
    );
    return res.status(201).json({
      data: response,
      success: true,
      message: "Successfully updated a employee",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to update a employee",
      err: error,
    });
  }
};

const getAll = async (req, res) => {
  try {
    const {
      search = "",
      division = "",
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

    const response = await employeeService.getAllEmployees({
      search,
      division,
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
      message: "Successfully fetched all employees",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to fetch all eployees",
      err: error,
    });
  }
};

const searchEmployeeByName = async (req, res) => {
  try {
    const {
      name = "",
      division = "",
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

    const response = await employeeService.searchEmployeeByName(name, {
      division,
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
      message: "Successfully fetched employee matching the name",
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Not able to search employee",
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
  searchEmployeeByName,
};
