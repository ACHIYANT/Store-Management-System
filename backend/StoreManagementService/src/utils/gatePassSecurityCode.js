const crypto = require("crypto");

function generateGatePassSecurityCode({ passNo, gatePassId }) {
  const secret = process.env.GATE_PASS_SECRET || "HARTRON_GATE_PASS_KEY";

  return crypto
    .createHmac("sha256", secret)
    .update(`${passNo}|${gatePassId}`)
    .digest("hex")
    .substring(0, 12)
    .toUpperCase();
}

module.exports = { generateGatePassSecurityCode };
