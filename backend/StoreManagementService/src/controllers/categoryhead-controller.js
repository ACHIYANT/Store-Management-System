const CategoryHeadService = require("../services/categoryhead-service");

const service = new CategoryHeadService();

const create = async (req, res) => {
  try {
    const result = await service.createCategoryHead(req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAll = async (req, res) => {
  try {
    const result = await service.getAllCategoryHeads();
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getById = async (req, res) => {
  try {
    const result = await service.getCategoryHeadById(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Category Head not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const update = async (req, res) => {
  try {
    const result = await service.updateCategoryHead(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const destroy = async (req, res) => {
  try {
    await service.deleteCategoryHead(req.params.id);
    return res.status(200).json({
      success: true,
      message: "Category Head deleted",
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
  getAll,
  getById,
  update,
  destroy,
};
