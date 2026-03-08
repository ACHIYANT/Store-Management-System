const UploadRepository = require("../repository/upload-repository");

const uploadFile = (req, folder) => {
  if (!req.file) {
    throw new Error("No file uploaded");
  }

  const url = UploadRepository.getFileUrl(req, folder);
  return url;
};

module.exports = {
  uploadFile,
};
