const express = require("express");
const cors = require("cors");

const { JWT_KEY, PASSWORD_CHANGE_JWT_KEY, PORT } = require("./config/serverConfig");
const apiRoutes = require("./routes/index");
const db = require("./models");
const {
  apiRateLimiter,
  buildCorsOptions,
  sanitizeJsonErrorResponses,
  securityHeaders,
} = require("./middlewares/security-middleware");
const { csrfProtection } = require("./middlewares/csrf-middleware");
const {
  requestContextMiddleware,
} = require("./middlewares/request-context-middleware");
const {
  forensicAuditMiddleware,
} = require("./middlewares/forensic-audit-middleware");
const {
  forensicAuditService,
} = require("./services/forensic-audit-service");

const app = express();
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const HOST = String(process.env.HOST || "127.0.0.1").trim() || "127.0.0.1";

const validateSecurityConfiguration = () => {
  const jwtKey = String(JWT_KEY || "").trim();
  if (!jwtKey || jwtKey.length < 32) {
    throw new Error(
      "JWT_KEY must be configured and at least 32 characters long.",
    );
  }
  const passwordChangeKey = String(PASSWORD_CHANGE_JWT_KEY || JWT_KEY || "").trim();
  if (!passwordChangeKey || passwordChangeKey.length < 32) {
    throw new Error(
      "PASSWORD_CHANGE_JWT_KEY must be configured (or fall back to JWT_KEY) and at least 32 characters long.",
    );
  }
};

const prepareAndStartServer = async () => {
  validateSecurityConfiguration();
  app.disable("x-powered-by");
  if (String(process.env.TRUST_PROXY || "").toLowerCase() === "true") {
    app.set("trust proxy", 1);
  }

  const corsOptions = buildCorsOptions();
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use(securityHeaders);
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "1mb" }));
  app.use(
    express.urlencoded({
      extended: true,
      limit: process.env.URLENCODED_BODY_LIMIT || "1mb",
    }),
  );
  app.use(requestContextMiddleware);
  app.use(forensicAuditMiddleware());
  app.use((req, res, next) => {
    if (
      req?.originalUrl === "/api/v1/signin" ||
      req?.originalUrl === "/api/v1/csrf-token"
    ) {
      const startedAt = Date.now();
      res.on("finish", () => {
        console.log(
          `[AUTH] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`,
        );
      });
    }
    return next();
  });
  app.use((req, res, next) => {
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
      if (res.headersSent) return;
      return res.status(504).json({
        success: false,
        message: "Request timeout",
        data: {},
        err: {
          code: "REQUEST_TIMEOUT",
          message: "The request took too long to complete.",
        },
      });
    });
    return next();
  });
  app.use(apiRateLimiter);
  app.use(sanitizeJsonErrorResponses);
  app.use(
    "/api",
    csrfProtection({
      skipPaths: [
        "/v1/signup",
        "/v1/signin",
        "/v1/password/first-login/change",
        "/v1/csrf-token",
        "/v1/isAuthenticated",
        "/v1/users/isAuthenticated",
        "/v1/internal/users/provision-from-employee/validate",
        "/v1/internal/users/provision-from-employee/execute",
        "/v1/internal/users/activate-from-employee/validate",
        "/v1/internal/users/activate-from-employee/execute",
      ],
    }),
  );

  app.use("/api", apiRoutes);

  app.use((error, _req, res, next) => {
    if (error?.message === "CORS_NOT_ALLOWED") {
      return res.status(403).json({
        success: false,
        message: "CORS origin not allowed.",
        code: "CORS_NOT_ALLOWED",
        hint: "Please use an allowed origin for this application.",
        requestId: res.getHeader("x-request-id") || null,
        data: {},
        err: { code: "CORS_NOT_ALLOWED", message: "CORS origin not allowed." },
      });
    }
    return next(error);
  });

  app.use((error, _req, res, _next) => {
    console.error("AuthService unhandled error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
      hint: "Please try again in a moment.",
      requestId: res.getHeader("x-request-id") || null,
      data: {},
      err: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },
    });
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`AuthService started at port ${PORT}`);
  });

  server.on("error", (error) => {
    console.error("AuthService listen error:", error);
    process.exit(1);
  });

  server.on("close", () => {
    console.warn("AuthService server closed.");
  });

  if (
    String(process.env.DB_SYNC || "").toLowerCase() === "true" &&
    String(process.env.NODE_ENV || "").toLowerCase() !== "production"
  ) {
    await db.sequelize.sync({ alter: true });
  }

  forensicAuditService.startScheduler();
};

prepareAndStartServer().catch((error) => {
  console.error("AuthService startup failed:", error);
  process.exit(1);
});
