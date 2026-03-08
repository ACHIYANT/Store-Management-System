const axios = require("axios");
const AUTH_BASE_URL = process.env.AUTH_BASE_URL;

const getApprovalStages = async () => {
  try {
    const response = await axios.get(`${AUTH_BASE_URL}/approval/stages`);
    console.log("resdddd",response);
    return response.data;
  } catch (error) {
    console.error(
      "Error fetching approval stages",
      error?.response?.status,
      error?.response?.data
    );
    throw new Error("Stage fetch failed");
  }
};

module.exports = { getApprovalStages };
