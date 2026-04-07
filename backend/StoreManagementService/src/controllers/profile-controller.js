"use strict";

const { ProfileService } = require("../services/profile-service");

const profileService = new ProfileService();

const getMyProfile = async (req, res) => {
  try {
    const response = await profileService.getMyProfile(req);
    return res.status(200).json({
      success: true,
      message: "Successfully fetched the current profile.",
      data: response,
      err: {},
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch the current profile.",
      data: {},
      err: error,
    });
  }
};

module.exports = {
  getMyProfile,
};
