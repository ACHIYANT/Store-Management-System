const AssetRepository = require("./asset-repository");
const AssetEventRepository = require("./assetevent-repository");
const CategoryGroupRepository = require("./categorygroup-repository");
const DayBookRepository = require("./daybook-repository");
const DayBookItemSerialRepository = require("./daybookitemserials-repository");
const IssuedItemRepository = require("./issueditem-repository");
const RequisitionRepository = require("./requisition-repository");

module.exports = {
  VendorRepository: require("./vendor-repository"),
  EmployeeRepository: require("./employee-repository"),
  DayBookRepository: require("./daybook-repository"),
  UploadRepository: require("./upload-repository"),
  DayBookItemRepository: require("./daybookitem-repository"),
  ItemCategoryRepository: require("./itemCategory-repository"),
  StockRepository: require("./stock-repository"),
  IssuedItemRepository: require("./issueditem-repository"),
  DayBookItemSerialRepository: require("./daybookitemserials-repository"),
  AssetRepository: require("./asset-repository"),
  AssetEventRepository: require("./assetevent-repository"),
  CategoryHeadRepository: require("./cateogryhead-repository"),
  CategoryGroupRepository,
  RequisitionRepository,
};
