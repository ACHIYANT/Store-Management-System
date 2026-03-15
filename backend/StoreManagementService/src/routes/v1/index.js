const express = require("express");
const VendorController = require("../../controllers/vendor-controller");
const ItemCategoryController = require("../../controllers/itemCategory-controller");
const EmployeeController = require("../../controllers/employee-controller");
const CustodianController = require("../../controllers/custodian-controller");

const DayBookController = require("../../controllers/daybook-controller");
const router = express.Router();

const UploadController = require("../../controllers/upload-controller");
const ImageController = require("../../controllers/image-controller");

const DayBookItemController = require("../../controllers/daybookitem-controller");
const StockController = require("../../controllers/stock-controller");

const DayBookItemSerialController = require("../../controllers/daybookitemserials-controller");
const IssuedItemController = require("../../controllers/issueditem-controller");
const AssetController = require("../../controllers/asset-controller");
const AssetEventController = require("../../controllers/assetevent-controller");
const GatePassController = require("../../controllers/gatepass-controller");
const RequisitionController = require("../../controllers/requisition-controller");

const {
  uploadMigrationFile,
  validateMigrationFile,
  executeMigrationFile,
} = require("../../controllers/migration-controller");
const IssuedMigrationController = require("../../controllers/issued-migration-controller");
const EmployeeMigrationController = require("../../controllers/employee-migration-controller");
const VendorMigrationController = require("../../controllers/vendor-migration-controller");
const CategoryMasterMigrationController = require("../../controllers/category-master-migration-controller");

const {
  ensureAuth,
  requireAnyRole,
  requireAdminOperations,
} = require("../../middlewares/auth-middleware");
const { requireNextApprover } = require("../../middlewares/role-middleware");
const { DayBookService } = require("../../services/index");
const { DayBookRepository } = require("../../repository/index");

const {
  uploadEncryptedRequisition,
  uploadMigrationSpreadsheet,
} = require("../../middlewares/upload-middleware");

// const { uploadBill, uploadItem } = require("../../middlewares/upload-middleware");
const {
  uploadEncryptedBill,
  uploadEncryptedItem,
} = require("../../middlewares/upload-middleware");

const { verifyMrn } = require("../../controllers/mrn-verification-controller");

const CategoryHeadController = require("../../controllers/categoryhead-controller");
const CategoryGroupController = require("../../controllers/categorygroup-controller");
const ForensicAuditController = require("../../controllers/forensic-audit-controller");

// 🔎 Stage inbox — role-based (shows only what you can act on now)
router.use(ensureAuth);

router.post(
  "/vendor",
  ensureAuth,
  requireAdminOperations,
  VendorController.create,
);
router.delete(
  "/vendor/:id",
  ensureAuth,
  requireAdminOperations,
  VendorController.destroy,
);
router.get("/vendor/search", VendorController.searchVendorByName);
router.get("/vendor/:id", VendorController.get);
router.get("/vendor-by-Id/:id", VendorController.getById);
router.patch(
  "/vendor/:id",
  ensureAuth,
  requireAdminOperations,
  VendorController.update,
);
router.get("/vendor", VendorController.getAll);

router.post(
  "/itemCategory",
  ensureAuth,
  requireAdminOperations,
  ItemCategoryController.create,
);
router.delete(
  "/itemCategory/:id",
  ensureAuth,
  requireAdminOperations,
  ItemCategoryController.destroy,
);
router.get("/itemCategory/search", ItemCategoryController.filter);
router.get("/itemCategory/", ItemCategoryController.get);
router.get("/itemCategory-by-Id/:id", ItemCategoryController.getById);
router.patch(
  "/itemCategory/:id",
  ensureAuth,
  requireAdminOperations,
  ItemCategoryController.update,
);
router.get("/itemCategories", ItemCategoryController.getAll);

router.post(
  "/employee",
  ensureAuth,
  requireAdminOperations,
  EmployeeController.create,
);
router.delete(
  "/employee/:id",
  ensureAuth,
  requireAdminOperations,
  EmployeeController.destroy,
);
router.get("/employee/search", EmployeeController.searchEmployeeByName);
router.get("/employee/:id", EmployeeController.get);
router.patch(
  "/employee/:id",
  ensureAuth,
  requireAdminOperations,
  EmployeeController.update,
);
router.get("/employee", EmployeeController.getAll);

// Custodians (Division / Vehicle / Employee master)
router.post(
  "/custodians",
  ensureAuth,
  requireAdminOperations,
  CustodianController.create,
);
router.get("/custodians", CustodianController.list);
router.get("/custodians/:id", CustodianController.get);

router.post("/daybook", DayBookController.create);
router.post("/daybook/full", DayBookController.createFullDayBook);
router.get("/last-entry", DayBookController.getLastEntryForType);
router.get("/daybookById/:id", DayBookController.getById);
router.get("/daybook", DayBookController.getAll);
router.patch("/daybook/:id", DayBookController.update);
router.get("/daybook/search", DayBookController.searchDayBookByEntryNo);
router.get("/mrn", DayBookController.getDayBookForMrn);
router.get("/daybook/:id/full", DayBookController.getDayBookFullDetails);

router.put("/daybook/:id/items", DayBookItemController.updateDayBookItems);
router.put("/daybook/:id", DayBookController.update);
router.post("/daybook/:id/cancel-mrn", DayBookController.cancelMrn);

// ? Stocks Routes

router.get("/stocks", StockController.getAll);

router.post(
  "/move-items-to-stock/:daybookId",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  StockController.moveDayBookItemsToStock,
);
router.get("/stocks-by-category", StockController.getAllStocksByCategory);
router.get("/stock-items-all/:id", StockController.getStocksByCategoryId);

router.post(
  "/upload/bill",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedBill,
  UploadController.uploadBillFile,
);
router.post(
  "/upload/item",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedItem,
  UploadController.uploadItemFile,
);

router.get("/view-image", ImageController.viewDecryptedImage);

router.post("/daybook-items", DayBookItemController.createDayBookItems);
router.get(
  "/daybook-items/:id/additional-charges",
  DayBookItemController.getAdditionalChargesByDayBookId,
);
router.get("/daybook-items/:id", DayBookItemController.getItemsByDayBookId);

// ? DayBookItemSerial Routes
router.post("/daybook-item-serial", DayBookItemSerialController.createOne);

router.post(
  "/daybook-item-serials/bulk",
  DayBookItemSerialController.bulkUpsert,
);

router.get(
  "/daybook-item-serials/:daybook_item_id",
  DayBookItemSerialController.getByDayBookItem,
);

router.patch(
  "/daybook-item-serials/mark-migrated",
  DayBookItemSerialController.markMigrated,
);

router.delete(
  "/daybook-item-serials/:daybook_item_id",
  DayBookItemSerialController.deleteByDayBookItem,
);

// ? Issued Items
// Handles both non-serialized and serialized issuing
// Body:
//  - { stockId, employeeId, quantity }            // non-serialized
//  - { stockId, employeeId, assetIds: [1,2,3] }   // serialized
router.post(
  "/issue",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  IssuedItemController.issue,
);

// issue MANY in one request (JSON body)
router.post(
  "/issue/bulk",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  IssuedItemController.issueBulk,
);

// issue MANY + requisition image (multipart: field "file")
router.post(
  "/issue/bulk-with-requisition",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedRequisition,
  IssuedItemController.issueBulk,
);

// ? Requisitions (digital employee requisition workflow)
router.post("/requisitions", ensureAuth, RequisitionController.create);
router.get("/requisitions", ensureAuth, RequisitionController.list);
router.get(
  "/requisitions/for-issue",
  ensureAuth,
  RequisitionController.listForIssue,
);
router.get(
  "/requisitions/dashboard/my-summary",
  ensureAuth,
  RequisitionController.getUserDashboardSummary,
);
router.get("/requisitions/:id", ensureAuth, RequisitionController.getById);
router.patch(
  "/requisitions/:id/submit",
  ensureAuth,
  RequisitionController.submit,
);
router.patch(
  "/requisitions/:id/approve",
  ensureAuth,
  RequisitionController.approve,
);
router.patch(
  "/requisitions/:id/reject",
  ensureAuth,
  RequisitionController.reject,
);
router.patch(
  "/requisitions/:id/cancel",
  ensureAuth,
  RequisitionController.cancel,
);
router.patch(
  "/requisitions/:id/map-items",
  ensureAuth,
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  RequisitionController.mapItems,
);
router.post(
  "/requisitions/:id/attachments",
  ensureAuth,
  uploadEncryptedRequisition,
  RequisitionController.addAttachment,
);
// List issued items (both serialized and non-serialized)
router.get("/issued-items", IssuedItemController.search);

// ? Assets
router.post(
  "/daybook/:daybookId/finalize-approval",
  AssetController.finalizeApprovedDaybook,
);
router.get("/assets/instore/:stockId", AssetController.getInStoreByStock);
router.get("/assets/by-employee/:employeeId", AssetController.getByEmployee);
router.patch(
  "/assets/return",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedItem,
  AssetController.returnAssets,
);
router.patch(
  "/assets/transfer",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedItem,
  AssetController.transferAssets,
);
router.patch(
  "/assets/repair-out",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedItem,
  AssetController.repairOut,
);
router.patch(
  "/assets/repair-in",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  AssetController.repairIn,
);
router.patch(
  "/assets/finalize",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedItem,
  AssetController.finalize,
);
router.patch(
  "/assets/retain",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  uploadEncryptedItem,
  AssetController.retainAssets,
);
router.get("/assets", AssetController.getAll);
router.get("/assets/search", AssetController.getAssets);

// ? Asset Events
router.post("/asset-events", AssetEventController.create);
router.post("/asset-events/bulk", AssetEventController.bulkCreate);
router.get("/asset-events", AssetEventController.search);

// ? Gate Passes (repair out / in movement verification)
router.get("/gate-passes", GatePassController.list);
router.get("/gate-passes/verify", GatePassController.verifyByCode);
router.post(
  "/gate-passes/e-waste",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  GatePassController.createEWasteOutPass,
);
router.get("/gate-passes/:id", GatePassController.getById);
router.patch(
  "/gate-passes/:id/signatories",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  GatePassController.updateSignatories,
);
router.patch(
  "/gate-passes/:id/verify-out",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  GatePassController.verifyOut,
);
router.patch(
  "/gate-passes/:id/verify-in",
  requireAnyRole(["STORE_ENTRY", "SUPER_ADMIN"]),
  GatePassController.verifyIn,
);

router.get(
  "/asset-events/by-asset/:assetId",
  AssetEventController.getByAssetId,
);
router.get("/asset-events/timeline/:assetId", AssetEventController.getTimeline);

router.get(
  "/asset-events/by-daybook/:daybookId",
  AssetEventController.getByDayBookId,
);
router.get(
  "/asset-events/by-issued/:issuedItemId",
  AssetEventController.getByIssuedItemId,
);
router.get(
  "/asset-events/by-employee/:employeeId",
  AssetEventController.getByEmployeeHistory,
);
// ✅ Asset Category Summary
router.get("/assets-by-category", AssetController.getAssetsByCategorySummary);

// ✅ Assets by Category
router.get("/assets/by-category/:id", AssetController.getAssetsByCategory);

router.get("/asset-events/recent", AssetEventController.recent);

// Approve DayBook (move to next active stage)
router.patch(
  "/daybook/:id/approve",
  ensureAuth,
  DayBookController.approveDayBook,
);

// Reject DayBook (send back to Store)
router.patch(
  "/daybook/:id/reject",
  ensureAuth,
  DayBookController.rejectDayBook,
);

router.get("/mrn/verify", verifyMrn);

router.get("/mrn/filter", DayBookController.getMrnWithFilters);

router.post(
  "/migration/opening-stock/validate",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  validateMigrationFile,
);
router.post(
  "/migration/opening-stock/execute",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  executeMigrationFile,
);
router.post(
  "/migration/upload",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  uploadMigrationFile,
);
router.post(
  "/migration/issued-items/validate",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  IssuedMigrationController.validateUpload,
);
router.post(
  "/migration/issued-items/execute",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  IssuedMigrationController.executeUpload,
);
router.post(
  "/migration/employees/validate",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  EmployeeMigrationController.validateUpload,
);
router.post(
  "/migration/employees/execute",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  EmployeeMigrationController.executeUpload,
);
router.post(
  "/migration/vendors/validate",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  VendorMigrationController.validateUpload,
);
router.post(
  "/migration/vendors/execute",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  VendorMigrationController.executeUpload,
);
router.post(
  "/migration/category-master/validate",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  CategoryMasterMigrationController.validateUpload,
);
router.post(
  "/migration/category-master/execute",
  requireAdminOperations,
  uploadMigrationSpreadsheet,
  CategoryMasterMigrationController.executeUpload,
);

router.get(
  "/forensic-audit/logs",
  requireAdminOperations,
  ForensicAuditController.listLogs,
);
router.get(
  "/forensic-audit/archives",
  requireAdminOperations,
  ForensicAuditController.listArchives,
);
router.post(
  "/forensic-audit/maintenance/run",
  requireAdminOperations,
  ForensicAuditController.runMaintenance,
);

// ? Category head Routes
router.post(
  "/category-head",
  ensureAuth,
  requireAdminOperations,
  CategoryHeadController.create,
);
router.get("/category-head", CategoryHeadController.getAll);
router.get("/category-head/:id", CategoryHeadController.getById);
router.patch(
  "/category-head/:id",
  ensureAuth,
  requireAdminOperations,
  CategoryHeadController.update,
);
router.delete(
  "/category-head/:id",
  ensureAuth,
  requireAdminOperations,
  CategoryHeadController.destroy,
);

//? Category group Routes
router.post(
  "/category-group",
  ensureAuth,
  requireAdminOperations,
  CategoryGroupController.create,
);
router.get("/category-group", CategoryGroupController.getAll);
router.get("/category-group/:id", CategoryGroupController.getById);
router.get(
  "/category-group/by-head/:headId",
  CategoryGroupController.getByHead,
);
router.patch(
  "/category-group/:id",
  ensureAuth,
  requireAdminOperations,
  CategoryGroupController.update,
);
router.delete(
  "/category-group/:id",
  ensureAuth,
  requireAdminOperations,
  CategoryGroupController.destroy,
);

module.exports = router;
