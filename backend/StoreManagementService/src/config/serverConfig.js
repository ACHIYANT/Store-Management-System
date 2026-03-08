const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  PORT: process.env.PORT,
  AUTH_BASE_URL: process.env.AUTH_BASE_URL || "http://localhost:3001/api/v1",
};
