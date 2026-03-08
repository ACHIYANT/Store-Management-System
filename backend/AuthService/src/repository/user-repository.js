const { Op } = require("sequelize");
const { User, Role } = require("../models/index");
const ValidationError = require("../utils/validation-error");
const ClientError = require("../utils/client-error");
const { StatusCodes } = require("http-status-codes");

class UserRepository {
  async create(data) {
    try {
      const user = await User.create(data);
      return user;
    } catch (error) {
      if (error.name == "SequelizeValidationError") {
        throw new ValidationError(error);
      }
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }
  async destroy(userId) {
    try {
      await User.destroy({
        where: {
          id: userId,
        },
      });
      return true;
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }
  async getById(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: [
          "id",
          "empcode",
          "fullname",
          "mobileno",
          "designation",
          "division",
        ],
        include: [
          {
            model: Role,
            as: "roles",
            through: { attributes: [] },
            attributes: ["id", "name"],
          },
        ],
      });
      return user;
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }

  async getByMobileNo(userMobileNo) {
    try {
      const user = await User.findOne({
        where: {
          mobileno: userMobileNo,
        },
        include: [
          {
            model: Role,
            as: "roles", // make sure you defined alias in your model association
            through: { attributes: [] }, // exclude join table fields
            attributes: ["id", "name"], // only return id & name of roles
          },
        ],
      });
      if (!user) {
        throw new ClientError(
          "AttributeNotFound",
          "Invalid username sent in the request",
          "Please check the email, as there is no record of the username.",
          StatusCodes.NOT_FOUND,
        );
      }
      return user;
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }

  async isAdmin(userId) {
    try {
      const user = await User.findByPk(userId);
      const adminRoles = await Role.findAll({
        where: {
          name: {
            // [Op.in]: ["ADMIN", "SUPER_ADMIN"],
            [Op.in]: ["SUPER_ADMIN"],
          },
        },
      });
      if (!user || !adminRoles.length) return false;
      const checks = await Promise.all(
        adminRoles.map((role) => user.hasRole(role)),
      );
      return checks.some(Boolean);
    } catch (error) {
      console.log("Something went wrong on repository layer");
      throw error;
    }
  }
}

module.exports = UserRepository;
