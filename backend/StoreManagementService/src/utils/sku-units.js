"use strict";

const SKU_UNITS = Object.freeze([
  "Unit",
  "L",
  "mL",
  "m",
  "cm",
  "mm",
  "inch",
  "ft",
  "kg",
  "g",
  "mg",
  "pack",
  "box",
  "set",
  "pair",
  "roll",
  "sheet",
]);

const UNIT_ALIASES = new Map(
  SKU_UNITS.map((unit) => [unit.toLowerCase(), unit]),
);

UNIT_ALIASES.set("units", "Unit");
UNIT_ALIASES.set("nos", "Unit");
UNIT_ALIASES.set("no", "Unit");
UNIT_ALIASES.set("ltr", "L");
UNIT_ALIASES.set("liter", "L");
UNIT_ALIASES.set("litre", "L");
UNIT_ALIASES.set("ml", "mL");
UNIT_ALIASES.set("meter", "m");
UNIT_ALIASES.set("metre", "m");
UNIT_ALIASES.set("centimeter", "cm");
UNIT_ALIASES.set("centimetre", "cm");
UNIT_ALIASES.set("millimeter", "mm");
UNIT_ALIASES.set("millimetre", "mm");
UNIT_ALIASES.set("inches", "inch");
UNIT_ALIASES.set("feet", "ft");
UNIT_ALIASES.set("kilogram", "kg");
UNIT_ALIASES.set("gram", "g");
UNIT_ALIASES.set("milligram", "mg");

function normalizeSkuUnit(value, fallback = "Unit") {
  const raw = value === undefined || value === null ? "" : String(value).trim();
  if (!raw) return fallback;

  const normalized = UNIT_ALIASES.get(raw.toLowerCase());
  if (!normalized) {
    throw new Error(
      `Invalid sku_unit '${raw}'. Allowed units: ${SKU_UNITS.join(", ")}`,
    );
  }

  return normalized;
}

function sameSkuUnit(a, b) {
  return normalizeSkuUnit(a) === normalizeSkuUnit(b);
}

module.exports = {
  SKU_UNITS,
  normalizeSkuUnit,
  sameSkuUnit,
};
