"use strict";

const LOCATION_OPTIONS = Object.freeze([
  { value: "Panchkula", label: "Panchkula" },
  { value: "Ambala", label: "Ambala" },
  { value: "Gurugram", label: "Gurugram" },
]);

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const lookup = new Map();

for (const option of LOCATION_OPTIONS) {
  const normalized = normalizeText(option.value).toLowerCase();
  if (!lookup.has(normalized)) {
    lookup.set(normalized, option.value);
  }
}

const normalizeLocationValue = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return lookup.get(normalized.toLowerCase()) || null;
};

module.exports = {
  LOCATION_OPTIONS,
  normalizeLocationValue,
};
