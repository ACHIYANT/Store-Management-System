const crypto = require("crypto");

function generateMrnSecurityCode({ entryNo, daybookId }) {
  const secret = process.env.MRN_SECRET || "HARTRON_SECURE_KEY";

  return crypto
    .createHmac("sha256", secret)
    .update(`${entryNo}|${daybookId}`)
    .digest("hex")
    .substring(0, 12)
    .toUpperCase();
}

module.exports = { generateMrnSecurityCode };