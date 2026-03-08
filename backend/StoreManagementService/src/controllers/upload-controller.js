const UploadService = require("../services/upload-service");

const uploadBillFile = async (req, res) => {
  res.status(200).json({ url: req.encryptedFileUrl });
};

const uploadItemFile = async (req, res) => {
  res.status(200).json({ url: req.encryptedFileUrl });
};

module.exports = {
  uploadBillFile,
  uploadItemFile,
};
