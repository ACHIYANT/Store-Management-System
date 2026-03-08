"use strict";

const { Op } = require("sequelize");

function encodeCursor(payload) {
  if (!payload || typeof payload !== "object") return null;
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeCursor(rawCursor) {
  if (!rawCursor) return null;
  try {
    const decoded = Buffer.from(String(rawCursor), "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function normalizeLimit(value, fallback = 50, max = 500) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function asDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function appendAnd(where = {}, clause) {
  if (!clause) return where;
  const andList = Array.isArray(where[Op.and]) ? [...where[Op.and]] : [];
  andList.push(clause);
  return { ...where, [Op.and]: andList };
}

function applyDateIdDescCursor(where = {}, cursorParts, dateField, idField = "id") {
  if (!cursorParts) return where;
  const cursorDate = asDate(cursorParts[dateField]);
  const cursorId = asNumber(cursorParts[idField]);
  if (!cursorDate || cursorId == null) return where;

  return appendAnd(where, {
    [Op.or]: [
      { [dateField]: { [Op.lt]: cursorDate } },
      { [dateField]: cursorDate, [idField]: { [Op.lt]: cursorId } },
    ],
  });
}

function applyIdDescCursor(where = {}, cursorParts, idField = "id") {
  if (!cursorParts) return where;
  const cursorId = asNumber(cursorParts[idField]);
  if (cursorId == null) return where;
  return appendAnd(where, { [idField]: { [Op.lt]: cursorId } });
}

function applyStringIdAscCursor(where = {}, cursorParts, stringField, idField = "id") {
  if (!cursorParts) return where;
  const cursorString = cursorParts[stringField];
  const cursorId = asNumber(cursorParts[idField]);
  if (typeof cursorString !== "string" || cursorId == null) return where;

  return appendAnd(where, {
    [Op.or]: [
      { [stringField]: { [Op.gt]: cursorString } },
      { [stringField]: cursorString, [idField]: { [Op.gt]: cursorId } },
    ],
  });
}

function parseCursorMode(value) {
  return String(value || "").toLowerCase() === "true";
}

module.exports = {
  encodeCursor,
  decodeCursor,
  normalizeLimit,
  asDate,
  asNumber,
  applyDateIdDescCursor,
  applyIdDescCursor,
  applyStringIdAscCursor,
  parseCursorMode,
};

