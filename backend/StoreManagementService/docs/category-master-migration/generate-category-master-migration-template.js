"use strict";

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const OUT_FILE = path.join(
  __dirname,
  "category_master_migration_template.xlsx",
);

const HEADERS = [
  "row_no",
  "row_type",
  "head_name",
  "group_name",
  "category_name",
  "serialized_required",
];

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

function applyDropdownValidation(worksheet, startRow = 2, endRow = 5000) {
  for (let row = startRow; row <= endRow; row += 1) {
    worksheet.getCell(row, 2).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ["=row_type_options"],
      showErrorMessage: true,
      errorTitle: "Invalid row_type",
      error: "Select one of: HEAD, GROUP, CATEGORY",
    };

    worksheet.getCell(row, 6).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ["=serialized_options"],
      showErrorMessage: true,
      errorTitle: "Invalid serialized_required",
      error: "Use TRUE or FALSE.",
    };
  }
}

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "StoreManagementService";
  workbook.created = new Date();

  const instructions = workbook.addWorksheet("instructions");
  instructions.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Rule", key: "rule", width: 110 },
  ];
  setHeaderStyle(instructions.getRow(1));

  const instructionRows = [
    {
      field: "Sheet format",
      rule: "Fill only 'category_master' sheet. Keep header names unchanged.",
    },
    {
      field: "row_type",
      rule: "Mandatory. Allowed values: HEAD, GROUP, CATEGORY.",
    },
    {
      field: "HEAD row",
      rule: "Fill head_name. Leave group_name/category_name/serialized_required blank.",
    },
    {
      field: "GROUP row",
      rule: "Fill group_name. head_name can be blank if previous HEAD context should continue.",
    },
    {
      field: "CATEGORY row",
      rule: "Fill category_name and serialized_required (TRUE/FALSE). head/group can use previous context.",
    },
    {
      field: "Order",
      rule: "Keep hierarchy order as HEAD -> GROUP -> CATEGORY for clear validation.",
    },
    {
      field: "Upsert behavior",
      rule: "System matches by names (case-insensitive). Existing rows are updated/kept; new rows are created.",
    },
    {
      field: "Execute behavior",
      rule: "Execute API is transactional all-or-none. Any error rolls back full file.",
    },
  ];
  instructionRows.forEach((row) => instructions.addRow(row));
  instructions.views = [{ state: "frozen", ySplit: 1 }];

  const sheet = workbook.addWorksheet("category_master");
  sheet.columns = [
    { header: "row_no", key: "row_no", width: 10 },
    { header: "row_type", key: "row_type", width: 14 },
    { header: "head_name", key: "head_name", width: 32 },
    { header: "group_name", key: "group_name", width: 32 },
    { header: "category_name", key: "category_name", width: 38 },
    { header: "serialized_required", key: "serialized_required", width: 20 },
  ];
  setHeaderStyle(sheet.getRow(1));
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const sampleRows = [
    {
      row_no: 1,
      row_type: "HEAD",
      head_name: "IT Equipment",
      group_name: "",
      category_name: "",
      serialized_required: "",
    },
    {
      row_no: 2,
      row_type: "GROUP",
      head_name: "",
      group_name: "Laptops",
      category_name: "",
      serialized_required: "",
    },
    {
      row_no: 3,
      row_type: "CATEGORY",
      head_name: "",
      group_name: "",
      category_name: "Laptop i5 8GB 512GB",
      serialized_required: "TRUE",
    },
    {
      row_no: 4,
      row_type: "CATEGORY",
      head_name: "",
      group_name: "",
      category_name: "Laptop i7 16GB 1TB",
      serialized_required: "TRUE",
    },
    {
      row_no: 5,
      row_type: "GROUP",
      head_name: "",
      group_name: "Desktop Systems",
      category_name: "",
      serialized_required: "",
    },
    {
      row_no: 6,
      row_type: "CATEGORY",
      head_name: "",
      group_name: "",
      category_name: "Desktop Computer i5",
      serialized_required: "TRUE",
    },
    {
      row_no: 7,
      row_type: "HEAD",
      head_name: "Stationery",
      group_name: "",
      category_name: "",
      serialized_required: "",
    },
    {
      row_no: 8,
      row_type: "GROUP",
      head_name: "",
      group_name: "Paper",
      category_name: "",
      serialized_required: "",
    },
    {
      row_no: 9,
      row_type: "CATEGORY",
      head_name: "",
      group_name: "",
      category_name: "A4 Paper Rim",
      serialized_required: "FALSE",
    },
  ];
  sampleRows.forEach((row) => sheet.addRow(row));

  const validationSheet = workbook.addWorksheet("_validations");
  validationSheet.state = "veryHidden";

  const rowTypes = ["HEAD", "GROUP", "CATEGORY"];
  rowTypes.forEach((value, index) => {
    validationSheet.getCell(index + 1, 1).value = value;
  });

  const serializedValues = ["TRUE", "FALSE"];
  serializedValues.forEach((value, index) => {
    validationSheet.getCell(index + 1, 2).value = value;
  });

  workbook.definedNames.add("_validations!$A$1:$A$3", "row_type_options");
  workbook.definedNames.add("_validations!$B$1:$B$2", "serialized_options");

  applyDropdownValidation(sheet, 2, 5000);

  await workbook.xlsx.writeFile(OUT_FILE);
  return OUT_FILE;
}

if (require.main === module) {
  generateTemplate()
    .then((filePath) => {
      if (!fs.existsSync(filePath)) {
        throw new Error("Template file was not generated");
      }
      console.log(`Category master migration template generated: ${filePath}`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  generateTemplate,
  HEADERS,
};
