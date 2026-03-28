"use strict";

const { Vendors, sequelize } = require("../models");

class VendorMigrationService {
  static normalizeKey(key) {
    return String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  static toText(value) {
    if (value === undefined || value === null) return null;
    const clean = String(value).trim();
    return clean || null;
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
      row[VendorMigrationService.normalizeKey(key)] = value;
    });

    const get = (...aliases) => {
      for (const alias of aliases) {
        const value = row[VendorMigrationService.normalizeKey(alias)];
        if (value !== undefined) return value;
      }
      return null;
    };

    return {
      row_no: Number(get("row_no", "rowno")) || rowNo,
      sheet_name: VendorMigrationService.toText(get("sheet_name", "sheet")),
      name: VendorMigrationService.toText(get("name", "vendor_name")),
      address: VendorMigrationService.toText(get("address", "vendor_address")),
      gst_no: VendorMigrationService.toText(get("gst_no", "gst", "gstno")),
      mobile_no: VendorMigrationService.toMobile(
        get("mobile_no", "mobile", "mobileno"),
      ),
    };
  }

  _isEmptyRow(row) {
    return ![row.name, row.address, row.gst_no, row.mobile_no].some(
      (value) => value !== undefined && value !== null && String(value).trim() !== "",
    );
  }

  _normalizeRows(rows = []) {
    return (rows || [])
      .map((raw, idx) => VendorMigrationService.normalizeRow(raw, idx + 2))
      .filter((row) => !this._isEmptyRow(row));
  }

  _findDuplicateRowNumbers(rows = [], keyGetter) {
    const seen = new Map();
    const dupRowNos = new Set();

    for (const row of rows) {
      const key = keyGetter(row);
      if (key === null || key === undefined || key === "") continue;
      const normalizedKey = String(key).trim().toUpperCase();

      if (!seen.has(normalizedKey)) {
        seen.set(normalizedKey, row.row_no);
      } else {
        dupRowNos.add(row.row_no);
        dupRowNos.add(seen.get(normalizedKey));
      }
    }

    return dupRowNos;
  }

  _buildPayload(row) {
    return {
      name: row.name,
      address: row.address,
      gst_no: String(row.gst_no || "").trim().toUpperCase(),
      mobile_no:
        row.mobile_no === null || row.mobile_no === undefined || String(row.mobile_no).trim() === ""
          ? null
          : String(row.mobile_no).trim(),
    };
  }

  async _validateModel(payload) {
    const model = Vendors.build(payload);
    await model.validate();
  }

  _collectRequiredErrors(row) {
    const errors = [];

    if (!row.name) errors.push("name is required");
    if (!row.address) errors.push("address is required");
    if (!row.gst_no) errors.push("gst_no is required");

    return errors;
  }

  async _preparePlans(rows = []) {
    const normalizedRows = this._normalizeRows(rows);
    const duplicateGstRows = this._findDuplicateRowNumbers(
      normalizedRows,
      (row) => row.gst_no,
    );
    const duplicateMobileRows = this._findDuplicateRowNumbers(
      normalizedRows,
      (row) => row.mobile_no,
    );

    const plans = [];

    for (const row of normalizedRows) {
      const errors = this._collectRequiredErrors(row);
      const payload = this._buildPayload(row);

      if (duplicateGstRows.has(row.row_no)) {
        errors.push(`Duplicate gst_no in file: ${payload.gst_no}`);
      }
      if (payload.mobile_no && duplicateMobileRows.has(row.row_no)) {
        errors.push(`Duplicate mobile_no in file: ${payload.mobile_no}`);
      }

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
        const existingByGst = await Vendors.findOne({
          where: { gst_no: payload.gst_no },
          attributes: ["id", "gst_no"],
        });
        if (existingByGst) {
          errors.push(`gst_no '${payload.gst_no}' already exists`);
        }

        if (payload.mobile_no) {
          const existingByMobile = await Vendors.findOne({
            where: { mobile_no: payload.mobile_no },
            attributes: ["id", "mobile_no"],
          });
          if (existingByMobile) {
            errors.push(`mobile_no '${payload.mobile_no}' already exists`);
          }
        }
      }

      plans.push({
        row,
        payload,
        errors,
        action: errors.length === 0 ? "create" : null,
      });
    }

    return {
      plans,
      normalizedRowsCount: normalizedRows.length,
    };
  }

  async validate({ rows = [] }) {
    const { plans, normalizedRowsCount } = await this._preparePlans(rows);

    let readyRows = 0;
    let failedRows = 0;
    const details = plans.map((plan) => {
      const failed = plan.errors.length > 0;
      if (failed) failedRows += 1;
      else readyRows += 1;

      return {
        sheet: plan.row.sheet_name || "vendors",
        row_no: plan.row.row_no,
        gst_no: plan.payload.gst_no || null,
        status: failed ? "failed" : "ok",
        action: failed ? null : "create",
        message: failed ? plan.errors.join(" | ") : "Ready to create vendor",
      };
    });

    return {
      success: failedRows === 0,
      mode: "validate",
      summary: {
        total_rows: normalizedRowsCount,
        ready_rows: readyRows,
        failed_rows: failedRows,
        create_candidates: readyRows,
      },
      details,
    };
  }

  async execute({ rows = [] }) {
    const { plans, normalizedRowsCount } = await this._preparePlans(rows);

    const precheckDetails = plans.map((plan) => {
      const failed = plan.errors.length > 0;
      return {
        sheet: plan.row.sheet_name || "vendors",
        row_no: plan.row.row_no,
        gst_no: plan.payload.gst_no || null,
        status: failed ? "failed" : "ok",
        action: failed ? null : "create",
        message: failed ? plan.errors.join(" | ") : "Ready to import",
      };
    });
    const precheckFailed = precheckDetails.filter((row) => row.status === "failed").length;

    if (precheckFailed > 0) {
      return {
        success: false,
        mode: "execute",
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: 0,
          failed_rows: precheckFailed,
        },
        details: precheckDetails,
      };
    }

    const transaction = await sequelize.transaction();
    try {
      const details = [];
      for (const plan of plans) {
        await Vendors.create(plan.payload, { transaction });
        details.push({
          sheet: plan.row.sheet_name || "vendors",
          row_no: plan.row.row_no,
          gst_no: plan.payload.gst_no || null,
          status: "imported",
          action: "create",
          message: "Vendor created",
        });
      }

      await transaction.commit();
      return {
        success: true,
        mode: "execute",
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: details.length,
          failed_rows: 0,
        },
        details,
      };
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      return {
        success: false,
        mode: "execute",
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: 0,
          failed_rows: normalizedRowsCount,
        },
        details: plans.map((plan) => ({
          sheet: plan.row.sheet_name || "vendors",
          row_no: plan.row.row_no,
          gst_no: plan.payload.gst_no || null,
          status: "failed",
          action: "create",
          message: `Batch rolled back: ${error?.message || "Execution failed"}`,
        })),
      };
    }
  }
}

module.exports = {
  VendorMigrationService,
};
