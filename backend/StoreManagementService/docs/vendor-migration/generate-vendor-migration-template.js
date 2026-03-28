"use strict";

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const HEADERS = ["name", "address", "gst_no", "mobile_no"];

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("vendors");
  sheet.columns = HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.max(20, header.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  sheet.addRow({
    name: "ABC Traders",
    address: "Sector 17 Chandigarh",
    gst_no: "06ABCDE1234F1Z5",
    mobile_no: "9876543210",
  });
  sheet.addRow({
    name: "PQR Enterprises",
    address: "Industrial Area Panchkula",
    gst_no: "03PQRSX6789K2Z7",
    mobile_no: null,
  });

  const instructions = workbook.addWorksheet("instructions");
  instructions.columns = [{ header: "Instructions", key: "text", width: 120 }];
  instructions.addRow({
    text: "Fill data in 'vendors' sheet only. Do not change header names.",
  });
  instructions.addRow({
    text: "Required columns: name, address, gst_no. mobile_no is optional.",
  });
  instructions.addRow({
    text: "gst_no format: 2 digits + 5 letters + 4 digits + 1 letter + 1 entity code (1-9/A-Z) + Z + 1 checksum (0-9/A-Z). Example: 06ABCDE1234F1Z5.",
  });
  instructions.addRow({
    text: "This migration is insert-only. Existing gst_no or mobile_no will fail.",
  });

  const outputPath = path.join(
    __dirname,
    "vendor_migration_template.xlsx",
  );
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

if (require.main === module) {
  generateTemplate()
    .then((filePath) => {
      if (!fs.existsSync(filePath)) {
        throw new Error("Template file was not generated");
      }
      console.log(`Vendor migration template generated: ${filePath}`);
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
