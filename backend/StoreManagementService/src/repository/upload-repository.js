const path = require("path");
const getFileUrl = (req, folder) => {
  const fileName = req.file.filename;
  const host = `${req.protocol}://${req.get("host")}`;
  const fileUrl = `${host}/uploads/${folder}/${fileName}`;
  return fileUrl;
};
module.exports = {
  getFileUrl,
};
