const dotenv = require("dotenv");
dotenv.config();

module.exports = {
  PORT: Number(process.env.PORT || 3001),
  SALT_ROUNDS: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
  JWT_KEY: process.env.JWT_KEY,
};
