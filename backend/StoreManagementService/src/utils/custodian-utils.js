"use strict";

const { Custodian, Employee } = require("../models");

const ALLOWED_TYPES = new Set(["EMPLOYEE", "DIVISION", "VEHICLE"]);

const normalizeType = (value) => {
  if (value == null) return null;
  const type = String(value).trim().toUpperCase();
  return type || null;
};

const normalizeId = (value) => {
  if (value == null) return null;
  const id = String(value).trim();
  return id || null;
};

const normalizeEmpId = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const normalizeCustodianInput = ({ employeeId, custodianId, custodianType }) => {
  const type = normalizeType(custodianType);
  const idText = normalizeId(custodianId);
  const empId = normalizeEmpId(employeeId);

  if (!type) {
    if (empId != null) {
      return { type: "EMPLOYEE", id: String(empId), employeeId: empId };
    }
    if (idText) {
      const maybeEmpId = normalizeEmpId(idText);
      if (maybeEmpId != null) {
        return { type: "EMPLOYEE", id: String(maybeEmpId), employeeId: maybeEmpId };
      }
    }
    return null;
  }

  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(
      `Invalid custodianType. Allowed: ${Array.from(ALLOWED_TYPES).join(", ")}`,
    );
  }

  if (type === "EMPLOYEE") {
    const resolvedEmpId = empId ?? normalizeEmpId(idText);
    if (resolvedEmpId == null) {
      throw new Error("employeeId is required for EMPLOYEE custodian");
    }
    return { type, id: String(resolvedEmpId), employeeId: resolvedEmpId };
  }

  if (!idText) {
    throw new Error("custodianId is required for non-EMPLOYEE custodian");
  }

  return { type, id: idText, employeeId: null };
};

const toCustodianFields = (resolved) => {
  if (!resolved) {
    return { custodian_id: null, custodian_type: null };
  }
  return {
    custodian_id: String(resolved.id),
    custodian_type: resolved.type,
  };
};

const ensureCustodian = async (resolved, { transaction } = {}) => {
  if (!resolved) throw new Error("Custodian is required");

  if (resolved.type === "EMPLOYEE") {
    const employee = await Employee.findByPk(resolved.employeeId, { transaction });
    if (!employee) throw new Error("Employee not found");
    await Custodian.upsert(
      {
        id: String(employee.emp_id),
        custodian_type: "EMPLOYEE",
        display_name: employee.name,
        employee_id: employee.emp_id,
        is_active: true,
      },
      { transaction },
    );
    return {
      ...resolved,
      display_name: employee.name,
    };
  }

  const custodian = await Custodian.findByPk(resolved.id, { transaction });
  if (!custodian) throw new Error("Custodian not found");
  if (String(custodian.custodian_type) !== resolved.type) {
    throw new Error(
      `Custodian type mismatch (expected ${resolved.type}, got ${custodian.custodian_type})`,
    );
  }
  if (!custodian.is_active) throw new Error("Custodian is inactive");

  return {
    ...resolved,
    display_name: custodian.display_name,
  };
};

module.exports = {
  normalizeCustodianInput,
  ensureCustodian,
  toCustodianFields,
};
