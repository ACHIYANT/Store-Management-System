"use strict";

const { Employee } = require("../models");
const { EmployeeMigrationService } = require("./employee-migration-service");
const {
  executeEmployeeProvisionInAuthService,
  validateEmployeeProvisionInAuthService,
} = require("../utils/auth-provision-api");
const { buildMigrationActorLabel } = require("../utils/migration-api-utils");
const { normalizeLocationScope } = require("../utils/location-scope");

class EmployeeAccessService {
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
    ].some(
      (value) =>
        value !== undefined && value !== null && String(value).trim() !== "",
    );
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

  _buildImportContext(context = {}) {
    return {
      performed_by:
        context?.actorLabel ||
        buildMigrationActorLabel(context?.actorMeta?.requested_by || context),
      request_id: context?.requestId || null,
    };
  }

  _collectStoreEmployeeErrors(employee) {
    const errors = [];
    if (!employee?.name) errors.push("Store employee name is missing.");
    if (!employee?.mobile_no) errors.push("Store employee mobile_no is missing.");
    if (!employee?.designation) {
      errors.push("Store employee designation is missing.");
    }
    if (!employee?.division) errors.push("Store employee division is missing.");
    return errors;
  }

  _formatProvisionError(error) {
    const message = String(error?.message || "Provisioning failed").trim();
    const details = Array.isArray(error?.details)
      ? error.details.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    const hint = String(error?.hint || "").trim();
    const upstreamRequestId = String(error?.upstreamRequestId || "").trim();

    return [
      message,
      details.join(" | "),
      hint,
      upstreamRequestId ? `Auth Request ID: ${upstreamRequestId}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  async _preparePlans(rows = [], context = {}) {
    const normalizedRows = this._normalizeRows(rows);
    const duplicateEmpRows = this._findDuplicateRowNumbers(
      normalizedRows,
      (row) => row.emp_id,
    );

    const plans = [];

    for (const row of normalizedRows) {
      const errors = [];
      if (!Number.isInteger(row.emp_id) || row.emp_id <= 0) {
        errors.push("emp_id is required and must be a positive integer");
      }
      if (duplicateEmpRows.has(row.row_no)) {
        errors.push(`Duplicate emp_id in file: ${row.emp_id}`);
      }

      let storeEmployee = null;
      let preview = null;
      let action = null;

      if (errors.length === 0) {
        storeEmployee = await Employee.findByPk(row.emp_id, {
          attributes: [
            "emp_id",
            "name",
            "father_name",
            "email_id",
            "mobile_no",
            "designation",
            "division",
            "gender",
            "office_location",
          ],
        });

        if (!storeEmployee) {
          errors.push(`emp_id '${row.emp_id}' does not exist in Store employees`);
        }
      }

      if (errors.length === 0) {
        errors.push(...this._collectStoreEmployeeErrors(storeEmployee));
      }

      if (errors.length === 0) {
        try {
          preview = await validateEmployeeProvisionInAuthService(
            storeEmployee.toJSON(),
            {
              requestId: context?.requestId || null,
            },
          );
          action = preview?.action === "already_exists" ? "already_exists" : "provision";
        } catch (error) {
          errors.push(this._formatProvisionError(error));
        }
      }

      plans.push({
        row,
        storeEmployee: storeEmployee ? storeEmployee.toJSON() : null,
        normalizedLocationScope: normalizeLocationScope(
          storeEmployee?.office_location || row.office_location || null,
        ),
        preview,
        errors,
        action,
      });
    }

    return {
      plans,
      normalizedRowsCount: normalizedRows.length,
    };
  }

  async validate({ rows = [] }, context = {}) {
    const { plans, normalizedRowsCount } = await this._preparePlans(rows, context);

    let readyRows = 0;
    let failedRows = 0;
    let provisionCandidates = 0;
    let alreadyExistsRows = 0;

    const details = plans.map((plan) => {
      const failed = plan.errors.length > 0;
      if (failed) {
        failedRows += 1;
      } else {
        readyRows += 1;
        if (plan.action === "already_exists") {
          alreadyExistsRows += 1;
        } else {
          provisionCandidates += 1;
        }
      }

      return {
        sheet: plan.row.sheet_name || "employees",
        row_no: plan.row.row_no,
        emp_id: plan.row.emp_id,
        mobile_no: plan.storeEmployee?.mobile_no || null,
        division: plan.storeEmployee?.division || null,
        office_location: plan.storeEmployee?.office_location || null,
        location_scope: plan.normalizedLocationScope,
        status: failed ? "failed" : "ok",
        action: failed ? null : plan.action,
        message: failed
          ? plan.errors.join(" | ")
          : plan.action === "already_exists"
            ? "Auth user already exists for this employee"
            : "Ready to provision Auth user from Store employee",
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
        provision_candidates: provisionCandidates,
        already_exists_rows: alreadyExistsRows,
      },
      locations_in_file: [
        ...new Set(plans.map((plan) => plan.normalizedLocationScope).filter(Boolean)),
      ],
      details,
    };
  }

  async execute({ rows = [] }, context = {}) {
    const { plans, normalizedRowsCount } = await this._preparePlans(rows, context);

    const precheckDetails = plans.map((plan) => {
      const failed = plan.errors.length > 0;
      return {
        sheet: plan.row.sheet_name || "employees",
        row_no: plan.row.row_no,
        emp_id: plan.row.emp_id,
        mobile_no: plan.storeEmployee?.mobile_no || null,
        division: plan.storeEmployee?.division || null,
        office_location: plan.storeEmployee?.office_location || null,
        location_scope: plan.normalizedLocationScope,
        status: failed ? "failed" : "ok",
        action: failed ? null : plan.action,
        message: failed
          ? plan.errors.join(" | ")
          : plan.action === "already_exists"
            ? "Auth user already exists for this employee"
            : "Ready to provision Auth user from Store employee",
      };
    });

    const precheckFailed = precheckDetails.filter(
      (row) => row.status === "failed",
    ).length;

    if (precheckFailed > 0) {
      return {
        success: false,
        mode: "execute",
        import_context: this._buildImportContext(context),
        summary: {
          total_rows: normalizedRowsCount,
          provisioned_rows: 0,
          already_exists_rows: 0,
          failed_rows: precheckFailed,
        },
        locations_in_file: [
          ...new Set(plans.map((plan) => plan.normalizedLocationScope).filter(Boolean)),
        ],
        details: precheckDetails,
      };
    }

    let provisionedRows = 0;
    let alreadyExistsRows = 0;
    let failedRows = 0;
    const details = [];

    for (const plan of plans) {
      try {
        const result = await executeEmployeeProvisionInAuthService(
          plan.storeEmployee,
          {
            requestId: context?.requestId || null,
          },
        );

        if (result.action === "already_exists") {
          alreadyExistsRows += 1;
        } else {
          provisionedRows += 1;
        }

        details.push({
          sheet: plan.row.sheet_name || "employees",
          row_no: plan.row.row_no,
          emp_id: plan.row.emp_id,
          mobile_no: plan.storeEmployee?.mobile_no || null,
          division: plan.storeEmployee?.division || null,
          office_location: plan.storeEmployee?.office_location || null,
          location_scope: plan.normalizedLocationScope,
          status: "processed",
          action: result.action,
          auth_user_id: result?.user?.id || null,
          auth_request_id: result?.requestId || null,
          message:
            result.action === "already_exists"
              ? "Auth user already exists for this employee"
              : "Auth user provisioned from Store employee",
        });
      } catch (error) {
        failedRows += 1;
        details.push({
          sheet: plan.row.sheet_name || "employees",
          row_no: plan.row.row_no,
          emp_id: plan.row.emp_id,
          mobile_no: plan.storeEmployee?.mobile_no || null,
          division: plan.storeEmployee?.division || null,
          office_location: plan.storeEmployee?.office_location || null,
          location_scope: plan.normalizedLocationScope,
          status: "failed",
          action: plan.action || null,
          message: this._formatProvisionError(error),
        });
      }
    }

    return {
      success: failedRows === 0,
      mode: "execute",
      import_context: this._buildImportContext(context),
      summary: {
        total_rows: normalizedRowsCount,
        provisioned_rows: provisionedRows,
        already_exists_rows: alreadyExistsRows,
        failed_rows: failedRows,
      },
      locations_in_file: [
        ...new Set(plans.map((plan) => plan.normalizedLocationScope).filter(Boolean)),
      ],
      details,
    };
  }
}

module.exports = {
  EmployeeAccessService,
};
