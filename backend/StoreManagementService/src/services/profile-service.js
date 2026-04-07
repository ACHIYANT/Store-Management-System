"use strict";

const axios = require("axios");
const { AUTH_BASE_URL } = require("../config/serverConfig");
const { EmployeeRepository } = require("../repository");

const normalizeText = (value) => {
  const text = String(value || "").trim();
  return text || "";
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const getClientIp = (req) => {
  const forwardedFor = normalizeText(req.headers["x-forwarded-for"]);
  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")
        .map((part) => normalizeText(part))
        .find(Boolean) || null
    );
  }

  return (
    normalizeText(req.headers["x-real-ip"]) || normalizeText(req.ip) || null
  );
};

const detectBrowser = (userAgent = "") => {
  const ua = String(userAgent || "");
  if (!ua) return "Unknown browser";
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Google Chrome";
  if (/Firefox\//.test(ua)) return "Mozilla Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Trident\//.test(ua) || /MSIE /.test(ua)) return "Internet Explorer";
  return "Unknown browser";
};

const detectOperatingSystem = (userAgent = "") => {
  const ua = String(userAgent || "");
  if (!ua) return "Unknown OS";
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown OS";
};

const detectDeviceType = (userAgent = "") => {
  const ua = String(userAgent || "");
  if (!ua) return "Unknown device";
  if (/iPad|Tablet/.test(ua)) return "Tablet";
  if (/Mobile|Android|iPhone|iPod/.test(ua)) return "Mobile";
  return "Desktop";
};

class ProfileService {
  constructor() {
    this.employeeRepository = new EmployeeRepository();
  }

  buildForwardedAuthHeaders(req) {
    const headers = {
      "x-request-id": normalizeText(req.requestId) || undefined,
    };

    const authorization = normalizeText(req.headers.authorization);
    const accessToken = normalizeText(req.headers["x-access-token"]);
    const cookie = normalizeText(req.headers.cookie);

    if (authorization) headers.authorization = authorization;
    if (accessToken) headers["x-access-token"] = accessToken;
    if (cookie) headers.cookie = cookie;

    return headers;
  }

  async fetchAuthSessionStatus(req) {
    try {
      const response = await axios.get(`${AUTH_BASE_URL}/session/status`, {
        headers: this.buildForwardedAuthHeaders(req),
        timeout: Number(process.env.AUTH_REQUEST_TIMEOUT_MS || 5000),
      });

      return response?.data?.data || null;
    } catch (error) {
      return {
        authenticated: false,
        reason: {
          code: "AUTH_PROFILE_CONTEXT_UNAVAILABLE",
          message: "Live session details could not be resolved.",
          hint: "Refresh the page or try again in a moment.",
        },
        user: null,
        session: null,
      };
    }
  }

  buildDeviceSummary(req) {
    const userAgent = normalizeText(req.headers["user-agent"]);
    const acceptLanguage = normalizeText(req.headers["accept-language"]);
    const forwardedFor = normalizeText(req.headers["x-forwarded-for"]);

    return {
      ip_address: getClientIp(req),
      forwarded_for: forwardedFor || null,
      browser: detectBrowser(userAgent),
      operating_system: detectOperatingSystem(userAgent),
      device_type: detectDeviceType(userAgent),
      language: acceptLanguage ? acceptLanguage.split(",")[0] : null,
      user_agent: userAgent || null,
    };
  }

  buildEditableFieldState() {
    const notice =
      "Editing this field can currently be done only by the database admin. Please request database admin for any change.";

    return {
      account: {
        fullname: { editable: false, message: notice },
        mobileno: { editable: false, message: notice },
        designation: { editable: false, message: notice },
        division: { editable: false, message: notice },
      },
      employee: {
        name: { editable: false, message: notice },
        father_name: { editable: false, message: notice },
        email_id: { editable: false, message: notice },
        gender: { editable: false, message: notice },
        office_location: { editable: false, message: notice },
        mobile_no: { editable: false, message: notice },
      },
    };
  }

  async getMyProfile(req) {
    const authStatus = await this.fetchAuthSessionStatus(req);
    const liveUser = authStatus?.user || {};
    const actor = req.user || {};
    const empcode = Number(liveUser.empcode || actor.empcode || 0) || null;
    const employee = empcode
      ? await this.employeeRepository.getEmployee(empcode)
      : null;

    const roles = toArray(liveUser.roles).length
      ? toArray(liveUser.roles)
      : toArray(actor.roles);
    const locationScopes = toArray(liveUser.location_scopes).length
      ? toArray(liveUser.location_scopes)
      : toArray(actor.location_scopes);
    const assignments = toArray(liveUser.assignments).length
      ? toArray(liveUser.assignments)
      : toArray(actor.assignments);

    return {
      account: {
        id: liveUser.id || actor.id || null,
        empcode,
        fullname: liveUser.fullname || actor.fullname || null,
        mobileno: liveUser.mobileno || actor.mobileno || null,
        designation: liveUser.designation || actor.designation || null,
        division: liveUser.division || actor.division || null,
        roles,
      },
      employee: employee
        ? {
            emp_id: employee.emp_id,
            name: employee.name,
            father_name: employee.father_name,
            email_id: employee.email_id,
            designation: employee.designation,
            division: employee.division,
            gender: employee.gender,
            office_location: employee.office_location,
            mobile_no: employee.mobile_no,
          }
        : null,
      permissions: {
        roles,
        location_scopes: locationScopes,
        location_scope_source:
          liveUser.location_scope_source || actor.location_scope_source || null,
        assignments,
      },
      security: {
        must_change_password: Boolean(liveUser.must_change_password),
        password_changed_at: liveUser.password_changed_at || null,
        editable_fields: this.buildEditableFieldState(),
      },
      session: {
        auth_mode: authStatus?.session?.auth_mode || "cookie",
        token_source: authStatus?.session?.token_source || "cookie",
        issued_at: authStatus?.session?.issued_at || null,
        expires_at: authStatus?.session?.expires_at || null,
        expires_in_seconds: authStatus?.session?.expires_in_seconds ?? null,
        server_time:
          authStatus?.session?.server_time || new Date().toISOString(),
        device: this.buildDeviceSummary(req),
        status_reason:
          authStatus?.authenticated === false
            ? authStatus?.reason || null
            : null,
      },
    };
  }
}

module.exports = {
  ProfileService,
};
