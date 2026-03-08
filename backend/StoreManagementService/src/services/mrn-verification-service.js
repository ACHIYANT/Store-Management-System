const { DayBook } = require("../models");
const { generateMrnSecurityCode } = require("../utils/mrnSecurityCode");

async function verifyMrnByCode(securityCode) {
  // 1️⃣ Find DayBook by stored security code
  const daybook = await DayBook.findOne({
    where: { mrn_security_code: securityCode },
  });

  if (!daybook) {
    return {
      valid: false,
      reason: "Invalid verification code",
    };
  }

  // 2️⃣ Recompute hash (tamper check)
  const recomputedCode = generateMrnSecurityCode({
    entryNo: daybook.entry_no,
    daybookId: daybook.id,
  });

  if (recomputedCode !== securityCode) {
    return {
      valid: false,
      reason: "Verification failed (data mismatch)",
    };
  }

  // 3️⃣ Final valid response
  return {
    valid: true,
    entry_no: daybook.entry_no,
    status: daybook.status,
    verified_at: new Date(),
  };
}

module.exports = { verifyMrnByCode };
