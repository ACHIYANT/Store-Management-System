// controllers/daybookitemserial-controller.js
const { DayBookItemSerialService } = require("../services/index");

const service = new DayBookItemSerialService();

const createOne = async (req, res) => {
  try {
    const {
      daybook_item_id,
      serial_number,
      purchased_at,
      warranty_expiry,
      source,
    } =
      req.body;
    if (!daybook_item_id || !serial_number) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "daybook_item_id and serial_number are required",
        err: {},
      });
    }

    const data = await service.createOne({
      daybook_item_id,
      serial_number,
      purchased_at,
      warranty_expiry,
      source,
    });

    return res.status(201).json({
      data,
      success: true,
      message: "Serial created",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to create serial",
      err: error,
    });
  }
};

const bulkUpsert = async (req, res) => {
  try {
    // const { daybook_item_id, serials } = req.body; // serials: [{serial_number,purchased_at?,warranty_expiry?}]
    const { daybook_item_id, serials, purchased_at, warranty_expiry, source } =
      req.body;
    if (!daybook_item_id || !Array.isArray(serials)) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "daybook_item_id and serials[] are required",
        err: {},
      });
    }

    const data = await service.bulkUpsert(daybook_item_id, serials, {
      purchased_at,
      warranty_expiry,
      source,
    });
    return res.status(200).json({
      data,
      success: true,
      message: "Serials upserted",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to upsert serials",
      err: error,
    });
  }
};

const getByDayBookItem = async (req, res) => {
  try {
    const { daybook_item_id } = req.params;
    const data = await service.findByDayBookItem(daybook_item_id);
    return res.status(200).json({
      data,
      success: true,
      message: "Fetched serials for daybook item",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to fetch serials",
      err: error,
    });
  }
};

const markMigrated = async (req, res) => {
  try {
    const { ids } = req.body; // [id, id, ...]
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        data: {},
        success: false,
        message: "ids[] is required",
        err: {},
      });
    }
    const [affected] = await service.markMigratedByIds(ids);
    return res.status(200).json({
      data: { affected },
      success: true,
      message: "Marked as migrated",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to mark migrated",
      err: error,
    });
  }
};

const deleteByDayBookItem = async (req, res) => {
  try {
    const { daybook_item_id } = req.params;
    const affected = await service.deleteByDayBookItem(daybook_item_id);
    return res.status(200).json({
      data: { affected },
      success: true,
      message: "Deleted serials for daybook item",
      err: {},
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      data: {},
      success: false,
      message: "Failed to delete serials",
      err: error,
    });
  }
};

module.exports = {
  createOne,
  bulkUpsert,
  getByDayBookItem,
  markMigrated,
  deleteByDayBookItem,
};
