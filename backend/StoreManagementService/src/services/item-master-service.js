"use strict";

const { Op } = require("sequelize");
const {
  ItemMaster,
  ItemMasterAlias,
  ItemCategory,
} = require("../models");
const { normalizeSkuUnit } = require("../utils/sku-units");

function normalizeItemText(value) {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!clean) return "";
  const tokens = clean.split(/\s+/).filter(Boolean).sort();
  return tokens.join(" ");
}

function normalizeDisplayText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function toItemCodeFromId(id) {
  return `ITM-${String(Number(id) || 0).padStart(6, "0")}`;
}

async function upsertAlias({
  itemMasterId,
  aliasText,
  transaction = null,
}) {
  const alias = normalizeDisplayText(aliasText);
  const normalizedAlias = normalizeItemText(alias);
  if (!itemMasterId || !alias || !normalizedAlias) return;

  const existing = await ItemMasterAlias.findOne({
    where: {
      item_master_id: itemMasterId,
      normalized_alias: normalizedAlias,
    },
    transaction,
  });
  if (existing) return;

  await ItemMasterAlias.create(
    {
      item_master_id: itemMasterId,
      alias_text: alias,
      normalized_alias: normalizedAlias,
      is_active: true,
    },
    { transaction },
  );
}

async function ensureItemMaster({
  itemCategoryId,
  skuUnit,
  itemName,
  aliasText = null,
  transaction = null,
}) {
  const categoryIdNum = Number(itemCategoryId);
  if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) return null;

  const displayName = normalizeDisplayText(itemName);
  const normalizedName = normalizeItemText(displayName);
  if (!normalizedName) return null;

  const normalizedSku = normalizeSkuUnit(skuUnit || "Unit");

  let itemMaster = await ItemMaster.findOne({
    where: {
      item_category_id: categoryIdNum,
      sku_unit: normalizedSku,
      normalized_name: normalizedName,
    },
    transaction,
  });

  if (!itemMaster) {
    const category = await ItemCategory.findByPk(categoryIdNum, {
      attributes: ["serialized_required"],
      transaction,
    });

    itemMaster = await ItemMaster.create(
      {
        item_code: `TMP-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        display_name: displayName || normalizedName,
        normalized_name: normalizedName,
        item_category_id: categoryIdNum,
        sku_unit: normalizedSku,
        serialized_required: Boolean(category?.serialized_required),
        is_active: true,
      },
      { transaction },
    );

    const finalCode = toItemCodeFromId(itemMaster.id);
    await itemMaster.update({ item_code: finalCode }, { transaction });
  }

  await upsertAlias({
    itemMasterId: itemMaster.id,
    aliasText: aliasText || displayName || normalizedName,
    transaction,
  });
  await upsertAlias({
    itemMasterId: itemMaster.id,
    aliasText: itemMaster.display_name,
    transaction,
  });

  return itemMaster;
}

async function resolveItemMaster({
  itemCategoryId = null,
  skuUnit = null,
  itemName = null,
  autoCreate = false,
  transaction = null,
  maxSuggestions = 5,
}) {
  const displayName = normalizeDisplayText(itemName);
  const normalizedName = normalizeItemText(displayName);
  const normalizedSku = normalizeSkuUnit(skuUnit || "Unit");
  const categoryIdNum = Number(itemCategoryId);
  const hasCategory = Number.isFinite(categoryIdNum) && categoryIdNum > 0;

  if (!normalizedName) {
    return {
      itemMaster: null,
      ambiguous: false,
      suggestions: [],
    };
  }

  const aliasWhere = {
    normalized_alias: normalizedName,
    is_active: true,
  };

  const includeMasterWhere = {
    sku_unit: normalizedSku,
  };
  if (hasCategory) includeMasterWhere.item_category_id = categoryIdNum;

  const aliasMatches = await ItemMasterAlias.findAll({
    where: aliasWhere,
    include: [
      {
        model: ItemMaster,
        as: "itemMaster",
        where: includeMasterWhere,
        required: true,
      },
    ],
    limit: maxSuggestions,
    order: [["id", "ASC"]],
    transaction,
  });

  const aliasMasters = aliasMatches
    .map((row) => row.itemMaster)
    .filter(Boolean);

  if (aliasMasters.length === 1) {
    return { itemMaster: aliasMasters[0], ambiguous: false, suggestions: [] };
  }
  if (aliasMasters.length > 1) {
    return {
      itemMaster: null,
      ambiguous: true,
      suggestions: aliasMasters.slice(0, maxSuggestions),
    };
  }

  const identityWhere = {
    normalized_name: normalizedName,
    sku_unit: normalizedSku,
  };
  if (hasCategory) identityWhere.item_category_id = categoryIdNum;

  const direct = await ItemMaster.findAll({
    where: identityWhere,
    order: [["id", "ASC"]],
    limit: maxSuggestions,
    transaction,
  });

  if (direct.length === 1) {
    return { itemMaster: direct[0], ambiguous: false, suggestions: [] };
  }
  if (direct.length > 1) {
    return {
      itemMaster: null,
      ambiguous: true,
      suggestions: direct.slice(0, maxSuggestions),
    };
  }

  if (!autoCreate || !hasCategory) {
    const suggestWhere = {
      sku_unit: normalizedSku,
      normalized_name: { [Op.like]: `%${normalizedName}%` },
    };
    if (hasCategory) suggestWhere.item_category_id = categoryIdNum;

    const suggestions = await ItemMaster.findAll({
      where: suggestWhere,
      limit: maxSuggestions,
      order: [["updatedAt", "DESC"], ["id", "DESC"]],
      transaction,
    });
    return {
      itemMaster: null,
      ambiguous: false,
      suggestions,
    };
  }

  const created = await ensureItemMaster({
    itemCategoryId: categoryIdNum,
    skuUnit: normalizedSku,
    itemName: displayName,
    aliasText: displayName,
    transaction,
  });
  return {
    itemMaster: created,
    ambiguous: false,
    suggestions: [],
  };
}

module.exports = {
  normalizeItemText,
  normalizeDisplayText,
  ensureItemMaster,
  resolveItemMaster,
};

