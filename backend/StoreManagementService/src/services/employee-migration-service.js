"use strict";

const { Employee, sequelize } = require("../models");
const { normalizeLocationScope } = require("../utils/location-scope");
const { buildMigrationActorLabel } = require("../utils/migration-api-utils");

class EmployeeMigrationService {
  static normalizeKey(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  static toText(value) {
    if (value === undefined || value === null) return null;
    const clean = String(value).trim().replace(/\s+/g, " ");
    return clean || null;
  }

  static normalizeLocationLabel(value) {
    const clean = EmployeeMigrationService.toText(value);
    if (!clean) return null;
    return clean
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  static normalizeGender(value) {
    const clean = EmployeeMigrationService.toText(value);
    if (!clean) return null;
    const normalized = clean.toLowerCase();
    if (["male", "m"].includes(normalized)) return "Male";
    if (["female", "f"].includes(normalized)) return "Female";
    if (["other", "o"].includes(normalized)) return "Other";
    return null;
  }

  static toInteger(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    return n;
  }

  static toMobile(value) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      return String(Math.trunc(value)).trim();
    }
    const clean = String(value).trim();
    return clean || null;
  }

  static normalizeRow(rawRow = {}, rowNo = 0) {
    const row = {};
    Object.entries(rawRow || {}).forEach(([key, value]) => {
      row[EmployeeMigrationService.normalizeKey(key)] = value;
    });

    const get = (...aliases) => {
      for (const alias of aliases) {
        const value = row[EmployeeMigrationService.normalizeKey(alias)];
        if (value !== undefined) return value;
      }
      return null;
    };

    return {
      row_no:
        EmployeeMigrationService.toInteger(get("row_no", "rowno")) || rowNo,
      sheet_name: EmployeeMigrationService.toText(get("sheet_name", "sheet")),
      emp_id: EmployeeMigrationService.toInteger(
        get("emp_id", "employee_emp_id", "employee_id"),
      ),
      name: EmployeeMigrationService.toText(get("name", "employee_name")),
      father_name: EmployeeMigrationService.toText(get("father_name")),
      email_id: EmployeeMigrationService.toText(get("email_id", "email")),
      mobile_no: EmployeeMigrationService.toMobile(
        get("mobile_no", "mobile", "mobileno"),
      ),
      designation: EmployeeMigrationService.toText(get("designation")),
      division: EmployeeMigrationService.toText(get("division")),
      gender: EmployeeMigrationService.normalizeGender(get("gender", "sex")),
      office_location: EmployeeMigrationService.normalizeLocationLabel(
        get("office_location", "office", "office_loc"),
      ),
    };
  }

  _isEmptyRow(row) {
    return ![
      row.emp_id,
      row.name,
      row.father_name,
      row.email_id,
      row.mobile_no,
      row.designation,
      row.division,
      row.gender,
      row.office_location,
    ].some((value) => value !== undefined && value !== null && String(value).trim() !== "");
  }

  _normalizeRows(rows = []) {
    return (rows || [])
      .map((raw, idx) => EmployeeMigrationService.normalizeRow(raw, idx + 2))
      .filter((row) => !this._isEmptyRow(row));
  }

  _findDuplicateRowNumbers(rows = [], keyGetter) {
    const seen = new Map();
    const dupRowNos = new Set();

    for (const row of rows) {
      const key = keyGetter(row);
      if (key === null || key === undefined || key === "") continue;

      if (!seen.has(key)) {
        seen.set(key, row.row_no);
      } else {
        dupRowNos.add(row.row_no);
        dupRowNos.add(seen.get(key));
      }
    }

    return dupRowNos;
  }

  _buildPayload(row) {
    return {
      emp_id: row.emp_id,
      name: row.name,
      father_name: row.father_name,
      email_id: row.email_id,
      mobile_no: row.mobile_no,
      designation: row.designation,
      division: row.division,
      gender: row.gender,
      office_location: row.office_location,
    };
  }

  _buildImportContext(context = {}) {
    return {
      performed_by:
        context?.actorLabel ||
        buildMigrationActorLabel(context?.actorMeta?.requested_by || context),
    };
  }

  async _validateModel(payload) {
    const model = Employee.build(payload);
    await model.validate();
  }

  _collectRequiredErrors(row) {
    const errors = [];

    if (!Number.isInteger(row.emp_id) || row.emp_id <= 0) {
      errors.push("emp_id is required and must be a positive integer");
    }
    if (!row.name) errors.push("name is required");
    if (!row.father_name) errors.push("father_name is required");
    if (!row.email_id) errors.push("email_id is required");
    if (!row.mobile_no) errors.push("mobile_no is required");
    if (!row.designation) errors.push("designation is required");
    if (!row.division) errors.push("division is required");
    if (!row.gender) errors.push("gender is required and must be Male, Female, or Other");
    if (!row.office_location) errors.push("office_location is required");

    return errors;
  }

  async _preparePlans(rows = []) {
    const normalizedRows = this._normalizeRows(rows);

    const duplicateEmpRows = this._findDuplicateRowNumbers(
      normalizedRows,
      (row) => row.emp_id,
    );
    const duplicateMobileRows = this._findDuplicateRowNumbers(
      normalizedRows,
      (row) => row.mobile_no,
    );

    const plans = [];

    for (const row of normalizedRows) {
      const errors = this._collectRequiredErrors(row);

      if (duplicateEmpRows.has(row.row_no)) {
        errors.push(`Duplicate emp_id in file: ${row.emp_id}`);
      }
      if (duplicateMobileRows.has(row.row_no)) {
        errors.push(`Duplicate mobile_no in file: ${row.mobile_no}`);
      }

      const payload = this._buildPayload(row);
      const normalizedLocationScope = normalizeLocationScope(row.office_location);
      let existingEmployee = null;
      let action = null;

      if (errors.length === 0) {
        try {
          await this._validateModel(payload);
        } catch (error) {
          if (Array.isArray(error?.errors) && error.errors.length > 0) {
            for (const err of error.errors) {
              errors.push(err.message || "Validation error");
            }
          } else {
            errors.push(error?.message || "Validation error");
          }
        }
      }

      if (errors.length === 0) {
        existingEmployee = await Employee.findByPk(payload.emp_id);
        if (existingEmployee) {
          errors.push(`emp_id '${payload.emp_id}' already exists`);
        }

        const mobileOwner = await Employee.findOne({
          where: { mobile_no: payload.mobile_no },
          attributes: ["emp_id", "mobile_no"],
        });

        if (
          mobileOwner &&
          Number(mobileOwner.emp_id) !== Number(payload.emp_id)
        ) {
          errors.push(
            `mobile_no '${payload.mobile_no}' already belongs to emp_id ${mobileOwner.emp_id}`,
          );
        }

        action = errors.length === 0 ? "create" : null;
      }

      plans.push({
        row,
        payload,
        normalizedLocationScope,
        errors,
        existingEmployee,
        action,
      });
    }

    return {
      plans,
      normalizedRowsCount: normalizedRows.length,
    };
  }

  async validate({ rows = [] }, context = {}) {
    const { plans, normalizedRowsCount } = await this._preparePlans(rows);

    let readyRows = 0;
    let failedRows = 0;
    let createCandidates = 0;
    let updateCandidates = 0;

    const details = plans.map((plan) => {
      const failed = plan.errors.length > 0;
      if (failed) {
        failedRows += 1;
      } else {
        readyRows += 1;
        if (plan.action === "create") createCandidates += 1;
      }

      return {
        sheet: plan.row.sheet_name || "employees",
        row_no: plan.row.row_no,
        emp_id: plan.row.emp_id,
        gender: plan.row.gender,
        office_location: plan.row.office_location,
        location_scope: plan.normalizedLocationScope,
        status: failed ? "failed" : "ok",
        action: failed ? null : plan.action,
        message: failed
          ? plan.errors.join(" | ")
          : "Ready to create employee",
      };
    });

    return {
      success: failedRows === 0,
      mode: "validate",
      import_context: this._buildImportContext(context),
      summary: {
        total_rows: normalizedRowsCount,
        ready_rows: readyRows,
        failed_rows: failedRows,
        create_candidates: createCandidates,
        update_candidates: updateCandidates,
      },
      locations_in_file: [
        ...new Set(plans.map((plan) => plan.normalizedLocationScope).filter(Boolean)),
      ],
      details,
    };
  }

  async execute({ rows = [] }, context = {}) {
    const { plans, normalizedRowsCount } = await this._preparePlans(rows);

    const precheckDetails = plans.map((plan) => {
      const failed = plan.errors.length > 0;
      return {
        sheet: plan.row.sheet_name || "employees",
        row_no: plan.row.row_no,
        emp_id: plan.row.emp_id,
        gender: plan.row.gender,
        office_location: plan.row.office_location,
        location_scope: plan.normalizedLocationScope,
        status: failed ? "failed" : "ok",
        action: failed ? null : plan.action,
        message: failed ? plan.errors.join(" | ") : "Ready to import",
      };
    });
    const precheckFailed = precheckDetails.filter((row) => row.status === "failed").length;

    if (precheckFailed > 0) {
      return {
        success: false,
        mode: "execute",
        import_context: this._buildImportContext(context),
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: 0,
          updated_rows: 0,
          failed_rows: precheckFailed,
        },
        locations_in_file: [
          ...new Set(plans.map((plan) => plan.normalizedLocationScope).filter(Boolean)),
        ],
        details: precheckDetails,
      };
    }

    const transaction = await sequelize.transaction();
    try {
      const details = [];
      for (const plan of plans) {
        if (plan.action !== "create") {
          throw new Error(
            "Only new employee records can be imported. Existing emp_id values are not allowed.",
          );
        }

        await Employee.create(plan.payload, { transaction });
        details.push({
          sheet: plan.row.sheet_name || "employees",
          row_no: plan.row.row_no,
          emp_id: plan.row.emp_id,
          gender: plan.row.gender,
          office_location: plan.row.office_location,
          location_scope: plan.normalizedLocationScope,
          status: "imported",
          action: plan.action,
          message: "Employee created",
        });
      }

      await transaction.commit();
      return {
        success: true,
        mode: "execute",
        import_context: this._buildImportContext(context),
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: details.length,
          updated_rows: 0,
          failed_rows: 0,
        },
        locations_in_file: [
          ...new Set(plans.map((plan) => plan.normalizedLocationScope).filter(Boolean)),
        ],
        details,
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      return {
        success: false,
        mode: "execute",
        import_context: this._buildImportContext(context),
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: 0,
          updated_rows: 0,
          failed_rows: normalizedRowsCount,
        },
        locations_in_file: [
          ...new Set(plans.map((plan) => plan.normalizedLocationScope).filter(Boolean)),
        ],
        details: plans.map((plan) => ({
          sheet: plan.row.sheet_name || "employees",
          row_no: plan.row.row_no,
          emp_id: plan.row.emp_id,
          gender: plan.row.gender,
          office_location: plan.row.office_location,
          location_scope: plan.normalizedLocationScope,
          status: "failed",
          action: plan.action || null,
          message: `Batch rolled back: ${error?.message || "Execution failed"}`,
        })),
      };
    }
  }
}

module.exports = {
  EmployeeMigrationService,
};
