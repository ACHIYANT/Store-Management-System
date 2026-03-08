const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const { PORT } = require("./config/serverConfig");

const ApiRoutes = require("./routes/index");
const { apiErrorHandler } = require("./middlewares/error-middleware");
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

const { Vendors, DayBook } = require("./models/index");
const db = require("./models/index");




const setUpAndStartServer = async () => {
  app.disable("x-powered-by");
  if (String(process.env.TRUST_PROXY || "").toLowerCase() === "true") {
    app.set("trust proxy", 1);
  }

  app.use(cors(buildCorsOptions()));
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
  app.use(apiRateLimiter);
  app.use(sanitizeJsonErrorResponses);
  app.use("/api", csrfProtection());

  if (String(process.env.ENABLE_STATIC_UPLOADS || "").toLowerCase() === "true") {
    app.use("/uploads", express.static(path.join(__dirname, "uploads")));
  }
  app.use("/api", ApiRoutes);

  app.use((error, _req, res, next) => {
    if (error?.message === "CORS_NOT_ALLOWED") {
      return res.status(403).json({
        success: false,
        message: "CORS origin not allowed.",
        data: {},
        err: {},
      });
    }
    return next(error);
  });
  app.use(apiErrorHandler);

  app.use((error, _req, res, _next) => {
    console.error("StoreManagementService unhandled error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      data: {},
      err: {},
    });
  });

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`server started at ${PORT}`);

    if (String(process.env.SYNC_DB || "").toLowerCase() === "true") {
      await db.sequelize.sync({ alter: true });
    }

    forensicAuditService.startScheduler();
    // const daybooks = await DayBook.findAll({ include: Vendors });
    // console.log(daybooks);
    // db.sequelize.sync({ alter: true });

    // const daybooks = await DayBook.findOne({
    //   where: {
    //     id: 7,
    //   },
    // });
    // const vendor = await Vendors.findOne({
    //   where: {
    //     id: 2,
    //   },
    // });
    // const daybooks = await vendor.getDayBooks();
    // await vendor.addDayBooks({
    //   entry_no: "CI-05",

    // });
    // console.log(daybooks);
  });
};
setUpAndStartServer();
