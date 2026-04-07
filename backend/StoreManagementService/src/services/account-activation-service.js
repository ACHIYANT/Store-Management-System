"use strict";

const { Employee } = require("../models");
const {
  executeEmployeeActivationInAuthService,
  validateEmployeeActivationInAuthService,
} = require("../utils/auth-activation-api");
const { normalizeLocationScope } = require("../utils/location-scope");

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

const normalizeMobile = (value) => String(value || "").trim().replace(/\D/g, "");

const normalizeEmpcode = (value) => {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
};

const buildActivationError = ({
  statusCode = 400,
  code = "ACCOUNT_ACTIVATION_INVALID",
  message = "Unable to process account activation.",
  hint = "Please review the request and try again.",
  details = [],
  upstreamRequestId = null,
} = {}) => ({
  statusCode,
  code,
  message,
  hint,
  details: Array.isArray(details)
    ? details.map((entry) => normalizeText(entry)).filter(Boolean)
    : [],
  upstreamRequestId: normalizeText(upstreamRequestId) || null,
});

const maskMobile = (value) => {
  const mobile = normalizeMobile(value);
  if (mobile.length < 4) return "Not available";
  return `${mobile.slice(0, 2)}******${mobile.slice(-2)}`;
};

class AccountActivationService {
  async _getEmployeeByEmpcode(empcode) {
    return Employee.findByPk(empcode, {
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
  }

  _buildEmployeeSnapshot(employee) {
    return {
      emp_id: employee.emp_id,
      name: employee.name,
      designation: employee.designation,
      division: employee.division,
      office_location: employee.office_location,
      location_scope: normalizeLocationScope(employee.office_location || null),
      masked_mobile_no: maskMobile(employee.mobile_no),
    };
  }

  async _verifyEmployeeIdentity({ empcode, mobileno } = {}) {
    const normalizedEmpcode = normalizeEmpcode(empcode);
    const normalizedMobile = normalizeMobile(mobileno);

    if (!normalizedEmpcode) {
      throw buildActivationError({
        statusCode: 400,
        code: "EMPLOYEE_CODE_REQUIRED",
        message: "Employee code is required.",
        hint: "Enter a valid employee code to continue.",
      });
    }

    if (!normalizedMobile) {
      throw buildActivationError({
        statusCode: 400,
        code: "MOBILE_NUMBER_REQUIRED",
        message: "Registered mobile number is required.",
        hint: "Enter the mobile number linked to your employee record.",
      });
    }

    const employee = await this._getEmployeeByEmpcode(normalizedEmpcode);
    if (!employee) {
      throw buildActivationError({
        statusCode: 404,
        code: "EMPLOYEE_NOT_FOUND_IN_STORE",
        message: "No employee master record was found for this employee code.",
        hint: "Contact the administrator to complete employee onboarding.",
      });
    }

    if (!normalizeMobile(employee.mobile_no)) {
      throw buildActivationError({
        statusCode: 409,
        code: "EMPLOYEE_MOBILE_NOT_AVAILABLE",
        message: "This employee record does not have a registered mobile number.",
        hint: "Please ask the administrator to update the employee master first.",
      });
    }

    if (normalizeMobile(employee.mobile_no) !== normalizedMobile) {
      throw buildActivationError({
        statusCode: 403,
        code: "EMPLOYEE_VERIFICATION_FAILED",
        message: "The provided details do not match the employee master record.",
        hint: "Use the registered mobile number linked to your employee code.",
      });
    }

    return employee;
  }

  async validate({ empcode, mobileno } = {}, context = {}) {
    const employee = await this._verifyEmployeeIdentity({ empcode, mobileno });
    const preview = await validateEmployeeActivationInAuthService(
      employee.toJSON(),
      {
        requestId: context?.requestId || null,
      },
    );

    return {
      eligible: preview?.action === "activate",
      action: preview?.action || "activate",
      activation_state:
        preview?.activation_state ||
        (preview?.action === "already_exists" ? "already_exists" : "ready"),
      employee: this._buildEmployeeSnapshot(employee),
      auth: preview?.user
        ? {
            id: preview.user.id || null,
            empcode: preview.user.empcode || employee.emp_id,
            must_change_password: Boolean(preview.user.must_change_password),
          }
        : null,
    };
  }

  async execute(
    { empcode, mobileno, newPassword, confirmPassword } = {},
    context = {},
  ) {
    const employee = await this._verifyEmployeeIdentity({ empcode, mobileno });
    const result = await executeEmployeeActivationInAuthService(
      employee.toJSON(),
      {
        newPassword,
        confirmPassword,
      },
      {
        requestId: context?.requestId || null,
      },
    );

    return {
      activated: true,
      action: result?.action || "activated",
      activation_state: result?.activation_state || "active",
      employee: this._buildEmployeeSnapshot(employee),
      auth: result?.user
        ? {
            id: result.user.id || null,
            empcode: result.user.empcode || employee.emp_id,
            must_change_password: Boolean(result.user.must_change_password),
          }
        : null,
    };
  }

  async verifyLoginEligibility({ empcode } = {}) {
    const normalizedEmpcode = normalizeEmpcode(empcode);
    if (!normalizedEmpcode) {
      throw buildActivationError({
        statusCode: 400,
        code: "EMPLOYEE_CODE_REQUIRED",
        message: "Employee code is required.",
        hint: "Send a valid employee code to continue.",
      });
    }

    const employee = await this._getEmployeeByEmpcode(normalizedEmpcode);
    if (!employee) {
      throw buildActivationError({
        statusCode: 403,
        code: "EMPLOYEE_NOT_FOUND_IN_STORE",
        message: "This account is not eligible for Store sign-in yet.",
        hint: "Contact the administrator to complete employee onboarding.",
      });
    }

    return {
      allowed: true,
      employee: this._buildEmployeeSnapshot(employee),
    };
  }
}

module.exports = {
  AccountActivationService,
  buildActivationError,
};
