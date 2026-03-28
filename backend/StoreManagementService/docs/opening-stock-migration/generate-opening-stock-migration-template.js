"use strict";

const path = require("path");
const { Op } = require("sequelize");

let ExcelJS = null;
try {
  // eslint-disable-next-line global-require
  ExcelJS = require("exceljs");
} catch (_error) {
  // deferred message in main()
}

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_FILE = path.resolve(
  __dirname,
  "opening_stock_migration_template.xlsx",
);
const { SKU_UNITS } = require(path.resolve(ROOT, "src", "utils", "sku-units"));
const FALLBACK_CATEGORY_NAMES = ["Laptop", "Stationery", "Printer", "Furniture"];

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

function addRowsFromObjects(worksheet, headers, rows = []) {
  rows.forEach((obj) => {
    worksheet.addRow(headers.map((key) => obj?.[key] ?? ""));
  });
}

function addAutoFilter(worksheet, startCol, endCol, rowCount) {
  worksheet.autoFilter = {
    from: { row: 1, column: startCol },
    to: { row: Math.max(2, Number(rowCount || 2)), column: endCol },
  };
}

function setColumnWidths(worksheet, widths = []) {
  worksheet.columns = widths.map((width) => ({ width }));
}

function applyDropdownValidations({
  worksheet,
  startRow = 2,
  endRow = 5000,
  categoryNameColumn = 2, // B
  skuUnitColumn = 4, // D
}) {
  for (let row = startRow; row <= endRow; row += 1) {
    worksheet.getCell(row, categoryNameColumn).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ["=category_name_options"],
      showErrorMessage: true,
      errorTitle: "Invalid Category",
      error: "Choose category_name from dropdown.",
    };

    worksheet.getCell(row, skuUnitColumn).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ["=sku_unit_options"],
      showErrorMessage: true,
      errorTitle: "Invalid SKU Unit",
      error: "Choose sku_unit from dropdown.",
    };
  }
}

function buildWorkbook(categoryNames = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StoreManagementService";
  workbook.created = new Date();

  const instructionsHeaders = ["Field", "Rule"];
  const instructionsRows = [
    {
      Field: "Sheet format",
      Rule: "Use one sheet only: opening_stock.",
    },
    {
      Field: "Mandatory fields",
      Rule: "item_name, category_name, quantity, sku_unit, purchased_at, warranty_expiry are mandatory.",
    },
    {
      Field: "serialized category",
      Rule: "If selected category is serialized_required=true, serial_number is mandatory.",
    },
    {
      Field: "category_name",
      Rule: "Select from dropdown (driven by category_master).",
    },
    {
      Field: "sku_unit",
      Rule: "Select from dropdown list only.",
    },
    {
      Field: "Date format",
      Rule: "Use YYYY-MM-DD or Excel date cells for purchased_at and warranty_expiry.",
    },
    {
      Field: "Date rule",
      Rule: "warranty_expiry cannot be before purchased_at.",
    },
    {
      Field: "location_scope",
      Rule: "Optional only when your system has exactly one active location. In multi-location setups, give the location explicitly and use the same names used in Access Control, for example PANCHKULA.",
    },
  ];

  const openingHeaders = [
    "item_name",
    "category_name",
    "quantity",
    "sku_unit",
    "serial_number",
    "purchased_at",
    "warranty_expiry",
    "location_scope",
  ];

  const sampleRows = [
    {
      item_name: "HP Laptop i5 512GB",
      category_name: categoryNames[0] || "",
      quantity: 1,
      sku_unit: "Unit",
      serial_number: "HP-OPEN-0001",
      purchased_at: "2024-04-01",
      warranty_expiry: "2027-03-31",
      location_scope: "PANCHKULA",
    },
    {
      item_name: "A4 Paper Ream",
      category_name: categoryNames[1] || categoryNames[0] || "",
      quantity: 20,
      sku_unit: "pack",
      serial_number: "",
      purchased_at: "2025-01-15",
      warranty_expiry: "2025-12-31",
      location_scope: "PANCHKULA",
    },
  ];

  const categoryMasterHeaders = ["sr_no", "category_name"];
  const categoryMasterRows = categoryNames.map((name, index) => ({
    sr_no: index + 1,
    category_name: name,
  }));

  const instructionsSheet = workbook.addWorksheet("instructions");
  instructionsSheet.addRow(instructionsHeaders);
  setHeaderStyle(instructionsSheet.getRow(1));
  addRowsFromObjects(instructionsSheet, instructionsHeaders, instructionsRows);
  addAutoFilter(instructionsSheet, 1, 2, instructionsRows.length + 1);
  setColumnWidths(instructionsSheet, [28, 115]);
  instructionsSheet.views = [{ state: "frozen", ySplit: 1 }];

  const openingSheet = workbook.addWorksheet("opening_stock");
  openingSheet.addRow(openingHeaders);
  setHeaderStyle(openingSheet.getRow(1));
  addRowsFromObjects(openingSheet, openingHeaders, sampleRows);
  addAutoFilter(openingSheet, 1, 8, sampleRows.length + 1);
  setColumnWidths(openingSheet, [38, 28, 12, 12, 26, 16, 18, 18]);
  openingSheet.views = [{ state: "frozen", ySplit: 1 }];
  applyDropdownValidations({ worksheet: openingSheet });

  const categorySheet = workbook.addWorksheet("category_master");
  categorySheet.addRow(categoryMasterHeaders);
  setHeaderStyle(categorySheet.getRow(1));
  addRowsFromObjects(categorySheet, categoryMasterHeaders, categoryMasterRows);
  addAutoFilter(categorySheet, 1, 2, categoryMasterRows.length + 1);
  setColumnWidths(categorySheet, [10, 42]);
  categorySheet.views = [{ state: "frozen", ySplit: 1 }];

  const validationSheet = workbook.addWorksheet("_validations");
  validationSheet.state = "veryHidden";

  if (categoryNames.length === 0) {
    validationSheet.getCell("A1").value = "No Category";
  } else {
    categoryNames.forEach((name, index) => {
      validationSheet.getCell(index + 1, 1).value = name;
    });
  }
  SKU_UNITS.forEach((unit, index) => {
    validationSheet.getCell(index + 1, 2).value = unit;
  });

  workbook.definedNames.add(
    `_validations!$A$1:$A$${Math.max(1, categoryNames.length)}`,
    "category_name_options",
  );
  workbook.definedNames.add(
    `_validations!$B$1:$B$${Math.max(1, SKU_UNITS.length)}`,
    "sku_unit_options",
  );

  return workbook;
}

async function resolveCategoryNames() {
  try {
    const liveNames = await readCategoryNamesFromDb();
    if (!liveNames.length) {
      throw new Error(
        "No categories found in ItemCategories table. Seed/create categories first.",
      );
    }
    return { names: liveNames, source: "database" };
  } catch (_error) {
    return { names: FALLBACK_CATEGORY_NAMES, source: "fallback" };
  }
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
  console.log("Dropdown validation: enabled for category_name and sku_unit.");
}

main().catch((error) => {
  console.error("Failed to generate opening stock migration template:", error);
  process.exit(1);
});
