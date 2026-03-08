const AssetService = require("./asset-service");
const AssetEventService = require("./assetevent-service");
const CategoryGroupService = require("./categorygroup-service");
const CategoryHeadService = require("./categoryhead-service");
const DayBookEntrySequenceService = require("./daybook-entry-sequence-service");
const DayBookItemSerialService = require("./daybookitemserials-service");
const GatePassService = require("./gatepass-service");
const IssuedItemService = require("./issueditem-services");
const RequisitionService = require("./requisition-service");

module.exports = {
  VendorService: require("./vendor-service"),
  EmployeeService: require("./employee-service"),
  DayBookService: require("./daybook-service"),
  DayBookItemService: require("./daybookitem-service"),
  ItemCategoryService: require("./itemCategory-service"),
  StockService: require("./stock-service"),
  DayBookItemSerialService: require("./daybookitemserials-service"),
  IssuedItemService: require("./issueditem-services"),
  AssetService: require("./asset-service"),
  AssetEventService: require("./assetevent-service"),
  CategoryGroupService: require("./categorygroup-service"),
  CategoryHeadService: require("./categoryhead-service"),
  DayBookEntrySequenceService: require("./daybook-entry-sequence-service"),
  GatePassService: require("./gatepass-service"),
  RequisitionService,
};
