const jwt = require("jsonwebtoken");
const { getUserById } = require("../services/auth-service");

// Ensure this is the correct path

// Ensure the rest of the code remains the same

const ensureAuth = async (req, res, next) => {
  try {
    const token = req.header("x-access-token");
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await getUserById(decoded.userId); // Ensure this fetches user info with roles
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const requireNextApprover = (req, res, next) => {
  const { next_role } = req.daybook; // Assuming `next_role` is in daybook record
  if (!next_role || req.user.role !== next_role) {
    return res
      .status(403)
      .json({ message: "Forbidden: You are not the next approver" });
  }
  next();
};

module.exports = { ensureAuth, requireNextApprover };
