const UserRepository = require("../repository/user-repository");
const jwt = require("jsonwebtoken");
const { JWT_KEY } = require("../config/serverConfig");
const bcrypt = require("bcrypt");

const withTimeout = (promise, timeoutMs, errorFactory) => {
  if (!Number.isFinite(Number(timeoutMs)) || Number(timeoutMs) <= 0) {
    return promise;
  }
  const ms = Number(timeoutMs);
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(errorFactory()), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

const invalidCredentialsError = () => ({
  statusCode: 401,
  message: "Invalid credentials",
  explanation: "Mobile number or password is incorrect.",
});

const authTimeoutError = () => ({
  statusCode: 503,
  message: "Authentication service timeout",
  explanation:
    "Unable to complete authentication right now. Please try again in a moment.",
});

class UserService {
  constructor() {
    this.UserRepository = new UserRepository();
  }

  async create(data) {
    try {
      const user = await this.UserRepository.create(data);
      return {
        id: user.id,
        empcode: user.empcode,
        fullname: user.fullname,
        mobileno: user.mobileno,
        designation: user.designation,
        division: user.division,
      };
    } catch (error) {
      if (error.name === "SequelizeValidationError") {
        throw error;
      }
      throw {
        statusCode: 500,
        message: "Unable to create user",
        explanation: "Something went wrong while creating user.",
      };
    }
  }

  async signIn(mobileno, plainPassword) {
    try {
      if (!mobileno || !plainPassword) {
        throw invalidCredentialsError();
      }

      const user = await withTimeout(
        this.UserRepository.getByMobileNo(mobileno),
        Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
        authTimeoutError,
      );
      const passwordMatch = this.checkPassword(plainPassword, user.password);

      if (!passwordMatch) {
        throw invalidCredentialsError();
      }

      const roles = user.roles ? user.roles.map((r) => r.name) : [];
      const newJWT = this.createToken({
        mobileno: user.mobileno,
        id: user.id,
        roles,
      });
      const fullName = user.fullname;
      return {
        newJWT,
        fullName,
        roles,
      };
    } catch (error) {
      if (error?.statusCode === 401 || error?.name === "AttributeNotFound") {
        throw invalidCredentialsError();
      }
      if (error?.statusCode === 503) {
        throw error;
      }
      throw {
        statusCode: 500,
        message: "Sign-in failed",
        explanation: "Unable to complete sign-in at this time.",
      };
    }
  }

  async isAuthenticated(token) {
    try {
      const response = this.verifyToken(token);
      if (!response) {
        throw { error: "Invalid Token" };
      }
      const user = await withTimeout(
        this.UserRepository.getById(response.id),
        Number(process.env.AUTH_DB_QUERY_TIMEOUT_MS || 10_000),
        authTimeoutError,
      );
      if (!user) {
        throw { error: "No user with the corresponding token exists." };
      }
      return {
        id: user.id,
        empcode: user.empcode,
        fullname: user.fullname,
        mobileno: user.mobileno,
        designation: user.designation,
        division: user.division,
        roles: Array.isArray(user.roles)
          ? user.roles.map((role) => role.name)
          : [],
      };
    } catch (error) {
      throw error;
    }
  }
  createToken(user) {
    try {
      if (!JWT_KEY || String(JWT_KEY).trim().length < 32) {
        throw new Error("JWT_KEY is missing or too weak.");
      }
      const result = jwt.sign(user, JWT_KEY, { expiresIn: "1d" });
      return result;
    } catch (error) {
      throw error;
    }
  }
  verifyToken(token) {
    try {
      const response = jwt.verify(token, JWT_KEY);
      return response;
    } catch (error) {
      throw error;
    }
  }

  checkPassword(userInputPlainPassword, encryptedPassword) {
    try {
      return bcrypt.compareSync(userInputPlainPassword, encryptedPassword);
    } catch (error) {
      throw error;
    }
  }

  isAdmin(userId) {
    try {
      return this.UserRepository.isAdmin(userId);
    } catch (error) {
      throw error;
    }
  }
}
module.exports = UserService;
