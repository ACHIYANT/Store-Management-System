const { DayBookItemService } = require("../services/index");

const dayBookItemService = new DayBookItemService();

const createDayBookItems = async (req, res) => {
  console.log("Received Payload:", req.body);
  try {
    // const { daybook_id, items } = req.body;
    const { daybook_id, items, additionalCharges = [] } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Items must be an array." });
    }

    const result = await dayBookItemService.createItemsAndCharges(
      daybook_id,
      items,
      additionalCharges,
      undefined,
      req.user || null,
    );
    res.status(201).json({ message: "Items added successfully", data: result });
  } catch (err) {
    console.error("Error adding items:", err);
    res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to add items",
      error: err?.message,
    });
  }
};
const updateDayBookItems = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const data = await dayBookItemService.replaceDayBookItems(
      id,
      payload,
      req.user || null,
    );

    return res.status(200).json({
      success: true,
      data,
      message: "DayBook items updated successfully",
    });
  } catch (error) {
    console.error("updateDayBookItems error:", error);
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to update DayBook items",
    });
  }
};

const getItemsByDayBookId = async (req, res) => {
  try {
    const { id } = req.params;
    const items = await dayBookItemService.getItemsByDayBookId(
      id,
      req.user || null,
    );
    res.status(200).json({ data: items });
  } catch (err) {
    res.status(err?.statusCode || 500).json({
      message: err?.message || "Failed to fetch items",
      error: err?.message,
    });
  }
};

const getAdditionalChargesByDayBookId = async (req, res) => {
  try {
    console.log("I am inside the getAdditionalChargesByDayBookId");
    const { id } = req.params;
    const charges =
      await dayBookItemService.getAdditionalChargesByDayBookId(
        id,
        req.user || null,
      );

    return res.status(200).json({
      success: true,
      data: charges,
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || "Failed to fetch additional charges",
    });
  }
};

module.exports = {
  createDayBookItems,
  getItemsByDayBookId,
  getAdditionalChargesByDayBookId,
  updateDayBookItems,
};
