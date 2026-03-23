"use strict";

const path = require("path");
const { Op } = require("sequelize");

let ExcelJS = null;
try {
  // eslint-disable-next-line global-require
  ExcelJS = require("exceljs");
} catch (error) {
  // Deferred user-facing message in main()
}

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_FILE = path.resolve(__dirname, "issued_items_migration_template.xlsx");

async function readCategoryNamesFromDb() {
  const { ItemCategory, sequelize } = require(path.resolve(ROOT, "src", "models"));
  try {
    const rows = await ItemCategory.findAll({
      attributes: ["category_name"],
      where: { category_name: { [Op.ne]: null } },
      order: [["category_name", "ASC"]],
      raw: true,
    });
    const names = rows
      .map((r) => String(r.category_name || "").trim())
      .filter(Boolean);
    return [...new Set(names)];
  } finally {
    await sequelize.close();
  }
}

function setHeaderStyle(row) {
  row.font = { bold: true, color: { argb: "FF1F2937" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      left: { style: "thin", color: { argb: "FF94A3B8" } },
      bottom: { style: "thin", color: { argb: "FF94A3B8" } },
      right: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });
}

function setColumnWidths(worksheet, widths = []) {
  worksheet.columns = widths.map((width) => ({ width }));
}

function addAutoFilter(worksheet, startCol, endCol, rowCount) {
  worksheet.autoFilter = {
    from: { row: 1, column: startCol },
    to: { row: Math.max(2, Number(rowCount || 2)), column: endCol },
  };
}

function addRowsFromObjects(worksheet, headers, rows = []) {
  rows.forEach((obj) => {
    worksheet.addRow(headers.map((key) => (obj?.[key] ?? "")));
  });
}

function applyDropdownValidations({
  worksheet,
  startRow = 2,
  endRow = 5000,
  itemTypeColumn = 5, // E
  categoryNameColumn = 6, // F
}) {
  for (let row = startRow; row <= endRow; row += 1) {
    worksheet.getCell(row, itemTypeColumn).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=item_type_options"],
      showErrorMessage: true,
      errorTitle: "Invalid Item Type",
      error: "Choose one of: Asset, Consumable",
    };

    worksheet.getCell(row, categoryNameColumn).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=category_name_options"],
      showErrorMessage: true,
      errorTitle: "Invalid Category",
      error: "Choose a category from dropdown list.",
    };
  }
}

function buildWorkbook(categoryNames) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StoreManagementService";
  workbook.created = new Date();

  const instructions = [
    {
      Field: "Sheet format",
      Rule: "Use one sheet only: issued_items (no separate asset/consumable sheets).",
    },
    {
      Field: "Employee-wise entry",
      Rule: "Fill employee details once, then keep employee fields blank for next rows of same employee.",
    },
    {
      Field: "item_type",
      Rule: "Required: Asset or Consumable.",
    },
    {
      Field: "employee_emp_id",
      Rule: "Required. Issued migration currently supports employee-based issuance only. Keep employee fields blank for continuation rows of the same employee.",
    },
    {
      Field: "Current scope",
      Rule: "Do not provide division/vehicle/custodian values in this migration. Historical issued data is imported in employee format only.",
    },
    {
      Field: "category_name",
      Rule: "Pick exact value from category_master sheet. category_id is optional and auto-resolved.",
    },
    {
      Field: "item_code / item_master_id",
      Rule: "Optional but recommended. If provided, system maps stock through item master first.",
    },
    {
      Field: "stock_id",
      Rule: "Optional. If not provided, system maps by item_name (+ category_name).",
    },
    {
      Field: "item_name",
      Rule: "Required when stock_id is blank.",
    },
    {
      Field: "sku_unit",
      Rule: "Optional; if provided, must match stock SKU unit.",
    },
    {
      Field: "Asset rows",
      Rule: "For item_type=Asset: serial_number is preferred. asset_tag is optional (auto-generated if blank for new assets).",
    },
    {
      Field: "Historical asset rows without serial number",
      Rule: "For old register data only: if serial_number and asset_tag are both blank, give the cumulative asset quantity in one row. The system will create that many issued asset records with migration placeholders internally.",
    },
    {
      Field: "Consumable rows",
      Rule: "For item_type=Consumable: quantity is required, whole number (>0).",
    },
    {
      Field: "issue_date",
      Rule: "Optional; accepts YYYY-MM-DD or Excel date.",
    },
    {
      Field: "Options",
      Rule: "API flags: adjustStock=true|false, createStockIfMissing=true|false",
    },
  ];

  const rows = [
    {
      item_no: 1,
      employee_emp_id: 101,
      employee_name: "Achiyant",
      division: "Procurement Division",
      item_type: "Asset",
      category_name: "Laptop",
      item_code: "",
      item_master_id: "",
      category_id: "",
      stock_id: "",
      item_name: "HP Laptop i5 512 GB 16 GB DDR4",
      serial_number: "SN-HP-0001",
      asset_tag: "",
      quantity: "",
      sku_unit: "Unit",
      issue_date: "2026-02-09",
      remarks: "Legacy issued migration (asset)",
      source_ref: "LEGACY-ISSUE-EMP101-01",
    },
    {
      item_no: 2,
      employee_emp_id: "",
      employee_name: "",
      division: "",
      item_type: "Consumable",
      category_name: "Stationery",
      item_code: "",
      item_master_id: "",
      category_id: "",
      stock_id: "",
      item_name: "A4 Paper Ream",
      serial_number: "",
      asset_tag: "",
      quantity: 5,
      sku_unit: "pack",
      issue_date: "2026-02-09",
      remarks: "Same employee block; employee fields left blank intentionally",
      source_ref: "LEGACY-ISSUE-EMP101-02",
    },
    {
      item_no: 3,
      employee_emp_id: 102,
      employee_name: "Employee Name",
      division: "Personnel & Administrative Division",
      item_type: "Asset",
      category_name: "Laptop",
      item_code: "",
      item_master_id: "",
      category_id: "",
      stock_id: "",
      item_name: "Laptops i5 512GB SSD 8GB RAM",
      serial_number: "",
      asset_tag: "",
      quantity: 30,
      sku_unit: "Unit",
      issue_date: "2026-02-11",
      remarks: "Historical asset issue without serial numbers",
      source_ref: "LEGACY-ISSUE-EMP102-01",
    },
  ];

  const categoryMaster = (categoryNames || []).map((name, index) => ({
    sr_no: index + 1,
    category_name: name,
  }));

  const instructionsHeaders = ["Field", "Rule"];
  const issuedHeaders = [
    "item_no",
    "employee_emp_id",
    "employee_name",
    "division",
    "item_type",
    "category_name",
    "item_code",
    "item_master_id",
    "category_id",
    "stock_id",
    "item_name",
    "serial_number",
    "asset_tag",
    "quantity",
    "sku_unit",
    "issue_date",
    "remarks",
    "source_ref",
  ];
  const categoryHeaders = ["sr_no", "category_name"];

  const instructionsSheet = workbook.addWorksheet("instructions");
  instructionsSheet.addRow(instructionsHeaders);
  setHeaderStyle(instructionsSheet.getRow(1));
  addRowsFromObjects(instructionsSheet, instructionsHeaders, instructions);
  addAutoFilter(instructionsSheet, 1, 2, instructions.length + 1);
  setColumnWidths(instructionsSheet, [28, 110]);
  instructionsSheet.views = [{ state: "frozen", ySplit: 1 }];

  const issuedSheet = workbook.addWorksheet("issued_items");
  issuedSheet.addRow(issuedHeaders);
  setHeaderStyle(issuedSheet.getRow(1));
  addRowsFromObjects(issuedSheet, issuedHeaders, rows);
  addAutoFilter(issuedSheet, 1, 18, rows.length + 1);
  setColumnWidths(issuedSheet, [
    10, // item_no
    16, // employee_emp_id
    28, // employee_name
    32, // division
    14, // item_type
    30, // category_name
    18, // item_code
    16, // item_master_id
    14, // category_id
    12, // stock_id
    40, // item_name
    24, // serial_number
    24, // asset_tag
    12, // quantity
    12, // sku_unit
    14, // issue_date
    42, // remarks
    26, // source_ref
  ]);
  issuedSheet.views = [{ state: "frozen", ySplit: 1 }];
  applyDropdownValidations({ worksheet: issuedSheet, startRow: 2, endRow: 5000 });

  const categorySheet = workbook.addWorksheet("category_master");
  categorySheet.addRow(categoryHeaders);
  setHeaderStyle(categorySheet.getRow(1));
  addRowsFromObjects(categorySheet, categoryHeaders, categoryMaster);
  addAutoFilter(categorySheet, 1, 2, categoryMaster.length + 1);
  setColumnWidths(categorySheet, [10, 42]);
  categorySheet.views = [{ state: "frozen", ySplit: 1 }];

  const validationSheet = workbook.addWorksheet("_validations");
  validationSheet.state = "veryHidden";
  validationSheet.getCell("A1").value = "Asset";
  validationSheet.getCell("A2").value = "Consumable";

  if (categoryNames.length === 0) {
    validationSheet.getCell("B1").value = "No Category";
  } else {
    categoryNames.forEach((name, index) => {
      validationSheet.getCell(index + 1, 2).value = name;
    });
  }

  workbook.definedNames.add("_validations!$A$1:$A$2", "item_type_options");
  workbook.definedNames.add(
    `_validations!$B$1:$B$${Math.max(1, categoryNames.length)}`,
    "category_name_options",
  );

  return workbook;
}

async function resolveCategoryNames() {
  const liveNames = await readCategoryNamesFromDb();
  if (!liveNames.length) {
    throw new Error(
      "No categories found in ItemCategories table. Seed/create categories first.",
    );
  }
  return { names: liveNames, source: "database" };
}

async function main() {
  if (!ExcelJS) {
    console.error(
      "exceljs is required to generate template with strict in-cell dropdowns.",
    );
    console.error("Run: npm install exceljs@^4.4.0");
    process.exit(1);
  }

  const { names: categoryNames, source } = await resolveCategoryNames();
  const workbook = buildWorkbook(categoryNames);
  await workbook.xlsx.writeFile(OUT_FILE);
  console.log(`Template generated at: ${OUT_FILE}`);
  console.log(`category_master rows: ${categoryNames.length}`);
  console.log(`category source: ${source}`);
  console.log("Dropdown validation: enabled for item_type and category_name.");
}

main().catch((error) => {
  console.error("Failed to generate issued migration template:", error);
  process.exit(1);
});
