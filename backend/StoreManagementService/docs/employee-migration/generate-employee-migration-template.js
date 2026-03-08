"use strict";

const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const HEADERS = [
  "emp_id",
  "name",
  "father_name",
  "email_id",
  "mobile_no",
  "designation",
  "division",
  "group_head",
  "office_location",
];

async function generateTemplate() {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("employees");
  sheet.columns = HEADERS.map((header) => ({
    header,
    key: header,
    width: Math.max(16, header.length + 4),
  }));

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  sheet.addRow({
    emp_id: 101,
    name: "Amit Kumar",
    father_name: "Raj Kumar",
    email_id: "amit.kumar@example.com",
    mobile_no: "9876543210",
    designation: "Assistant Manager",
    division: "Procurement",
    group_head: "Rohit Sharma",
    office_location: "Panchkula",
  });

  sheet.addRow({
    emp_id: 102,
    name: "Neha Verma",
    father_name: "Suresh Verma",
    email_id: "neha.verma@example.com",
    mobile_no: "9123456789",
    designation: "Executive",
    division: "Admin",
    group_head: "Anil Gupta",
    office_location: "Chandigarh",
  });

  const instructions = workbook.addWorksheet("instructions");
  instructions.columns = [{ header: "Instructions", key: "text", width: 120 }];
  instructions.addRow({
    text: "Fill data in 'employees' sheet only. Do not change header names.",
  });
  instructions.addRow({
    text: "Required columns: emp_id, name, father_name, email_id, mobile_no, designation, division, group_head, office_location.",
  });
  instructions.addRow({
    text: "emp_id must be a positive integer. mobile_no must be 10 digits and start with 6-9.",
  });
  instructions.addRow({
    text: "Use validate API first, then execute API.",
  });

  const outputPath = path.join(
    __dirname,
    "employee_migration_template.xlsx",
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
      console.log(`Employee migration template generated: ${filePath}`);
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

