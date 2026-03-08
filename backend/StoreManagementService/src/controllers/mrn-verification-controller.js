const { verifyMrnByCode } = require("../services/mrn-verification-service");

async function verifyMrn(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required",
      });
    }

    const result = await verifyMrnByCode(code);

    return res.status(result.valid ? 200 : 404).json({
      success: result.valid,
      data: result,
    });
  } catch (error) {
    console.error("MRN verification error:", error);
    return res.status(500).json({
      success: false,
      message: "MRN verification failed",
    });
  }
}

module.exports = { verifyMrn };
