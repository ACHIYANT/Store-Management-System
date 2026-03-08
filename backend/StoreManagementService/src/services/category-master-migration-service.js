"use strict";

const {
  sequelize,
  ItemCategoryHead,
  ItemCategoryGroup,
  ItemCategory,
} = require("../models");
const { Op, fn, col, where: sqlWhere } = require("sequelize");

class CategoryMasterMigrationService {
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

  static toBoolean(value) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "boolean") return value;

    const raw = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(raw)) return true;
    if (["0", "false", "no", "n", "off"].includes(raw)) return false;
    return null;
  }

  static normalizeNameKey(value) {
    return String(value || "").trim().toLowerCase();
  }

  static normalizeRow(rawRow = {}, rowNo = 0) {
    const row = {};
    Object.entries(rawRow || {}).forEach(([key, value]) => {
      row[CategoryMasterMigrationService.normalizeKey(key)] = value;
    });

    const get = (...aliases) => {
      for (const alias of aliases) {
        const value = row[CategoryMasterMigrationService.normalizeKey(alias)];
        if (value !== undefined) return value;
      }
      return null;
    };

    return {
      row_no: Number(get("row_no", "rowno")) || rowNo,
      sheet_name: CategoryMasterMigrationService.toText(get("sheet_name", "sheet")),
      row_type: CategoryMasterMigrationService.toText(get("row_type", "type")),
      head_name: CategoryMasterMigrationService.toText(
        get("head_name", "category_head", "category_head_name"),
      ),
      group_name: CategoryMasterMigrationService.toText(
        get("group_name", "category_group", "category_group_name"),
      ),
      category_name: CategoryMasterMigrationService.toText(
        get("category_name", "item_category", "item_category_name"),
      ),
      serialized_required_raw: get("serialized_required"),
    };
  }

  _isEmptyRow(row) {
    return ![
      row.row_type,
      row.head_name,
      row.group_name,
      row.category_name,
      row.serialized_required_raw,
    ].some((value) => value !== undefined && value !== null && String(value).trim() !== "");
  }

  _normalizeRows(rows = []) {
    return (rows || [])
      .map((raw, idx) => CategoryMasterMigrationService.normalizeRow(raw, idx + 2))
      .filter((row) => !this._isEmptyRow(row));
  }

  _inferRowType(row) {
    const explicit = String(row.row_type || "").trim().toUpperCase();
    if (["HEAD", "GROUP", "CATEGORY"].includes(explicit)) return explicit;

    if (row.category_name) return "CATEGORY";
    if (row.group_name) return "GROUP";
    if (row.head_name) return "HEAD";
    return null;
  }

  _buildBasePlans(rows = []) {
    const normalizedRows = this._normalizeRows(rows);
    const plans = [];
    const seenHead = new Set();
    const seenGroup = new Set();
    const seenCategory = new Set();

    let currentHeadName = null;
    let currentGroupName = null;

    for (const row of normalizedRows) {
      const errors = [];
      const rowType = this._inferRowType(row);
      if (!rowType) {
        errors.push("row_type is required (HEAD/GROUP/CATEGORY) or inferable columns are missing");
      }

      let resolvedHeadName = null;
      let resolvedGroupName = null;
      let resolvedCategoryName = null;
      let serializedRequired = null;

      if (rowType === "HEAD") {
        resolvedHeadName = row.head_name;
        if (!resolvedHeadName) {
          errors.push("head_name is required for HEAD row");
        } else {
          currentHeadName = resolvedHeadName;
          currentGroupName = null;

          const headKey = CategoryMasterMigrationService.normalizeNameKey(
            resolvedHeadName,
          );
          if (seenHead.has(headKey)) {
            errors.push(`Duplicate HEAD in file: '${resolvedHeadName}'`);
          } else {
            seenHead.add(headKey);
          }
        }
      }

      if (rowType === "GROUP") {
        resolvedGroupName = row.group_name;
        resolvedHeadName = row.head_name || currentHeadName;

        if (!resolvedHeadName) {
          errors.push(
            "GROUP row requires head_name or a previous HEAD context row",
          );
        }
        if (!resolvedGroupName) {
          errors.push("group_name is required for GROUP row");
        }

        if (resolvedHeadName && resolvedGroupName) {
          currentHeadName = resolvedHeadName;
          currentGroupName = resolvedGroupName;

          const groupKey = `${CategoryMasterMigrationService.normalizeNameKey(
            resolvedHeadName,
          )}||${CategoryMasterMigrationService.normalizeNameKey(
            resolvedGroupName,
          )}`;
          if (seenGroup.has(groupKey)) {
            errors.push(
              `Duplicate GROUP in file under head '${resolvedHeadName}': '${resolvedGroupName}'`,
            );
          } else {
            seenGroup.add(groupKey);
          }
        }
      }

      if (rowType === "CATEGORY") {
        resolvedCategoryName = row.category_name;
        resolvedHeadName = row.head_name || currentHeadName;
        resolvedGroupName = row.group_name || currentGroupName;
        serializedRequired = CategoryMasterMigrationService.toBoolean(
          row.serialized_required_raw,
        );

        if (!resolvedHeadName) {
          errors.push(
            "CATEGORY row requires head_name or a previous HEAD context row",
          );
        }
        if (!resolvedGroupName) {
          errors.push(
            "CATEGORY row requires group_name or a previous GROUP context row",
          );
        }
        if (!resolvedCategoryName) {
          errors.push("category_name is required for CATEGORY row");
        }
        if (serializedRequired === null) {
          errors.push(
            "serialized_required is required for CATEGORY row (TRUE/FALSE)",
          );
        }

        if (resolvedHeadName && resolvedGroupName && resolvedCategoryName) {
          currentHeadName = resolvedHeadName;
          currentGroupName = resolvedGroupName;

          const categoryKey = `${CategoryMasterMigrationService.normalizeNameKey(
            resolvedHeadName,
          )}||${CategoryMasterMigrationService.normalizeNameKey(
            resolvedGroupName,
          )}||${CategoryMasterMigrationService.normalizeNameKey(
            resolvedCategoryName,
          )}`;
          if (seenCategory.has(categoryKey)) {
            errors.push(
              `Duplicate CATEGORY in file under '${resolvedHeadName} > ${resolvedGroupName}': '${resolvedCategoryName}'`,
            );
          } else {
            seenCategory.add(categoryKey);
          }
        }
      }

      plans.push({
        row,
        row_type: rowType,
        head_name: resolvedHeadName,
        group_name: resolvedGroupName,
        category_name: resolvedCategoryName,
        serialized_required: serializedRequired,
        errors,
      });
    }

    return {
      plans,
      normalizedRowsCount: normalizedRows.length,
    };
  }

  async _findHeadByName(name, transaction = null) {
    const normalized = CategoryMasterMigrationService.normalizeNameKey(name);
    if (!normalized) return null;

    const heads = await ItemCategoryHead.findAll({
      where: sqlWhere(fn("LOWER", col("category_head_name")), normalized),
      transaction,
    });
    if (heads.length > 1) {
      throw new Error(
        `Multiple category heads found for '${name}'. Please clean duplicate heads first.`,
      );
    }
    return heads[0] || null;
  }

  async _findGroupByName(headId, name, transaction = null) {
    const normalized = CategoryMasterMigrationService.normalizeNameKey(name);
    if (!headId || !normalized) return null;

    const groups = await ItemCategoryGroup.findAll({
      where: {
        head_id: headId,
        [Op.and]: [sqlWhere(fn("LOWER", col("category_group_name")), normalized)],
      },
      transaction,
    });
    if (groups.length > 1) {
      throw new Error(
        `Multiple category groups found for '${name}' under head_id ${headId}. Please clean duplicates first.`,
      );
    }
    return groups[0] || null;
  }

  async _findCategoryByName(groupId, name, transaction = null) {
    const normalized = CategoryMasterMigrationService.normalizeNameKey(name);
    if (!groupId || !normalized) return null;

    const categories = await ItemCategory.findAll({
      where: {
        group_id: groupId,
        [Op.and]: [sqlWhere(fn("LOWER", col("category_name")), normalized)],
      },
      transaction,
    });
    if (categories.length > 1) {
      throw new Error(
        `Multiple categories found for '${name}' under group_id ${groupId}. Please clean duplicates first.`,
      );
    }
    return categories[0] || null;
  }

  async _previewPlans(plans = []) {
    const details = [];
    let failedRows = 0;
    let readyRows = 0;
    let createCandidates = 0;
    let updateCandidates = 0;

    const virtualHeads = new Set();
    const virtualGroups = new Set();

    for (const plan of plans) {
      const baseDetail = {
        sheet: plan.row.sheet_name || "category_master",
        row_no: plan.row.row_no,
        row_type: plan.row_type || null,
        head_name: plan.head_name || null,
        group_name: plan.group_name || null,
        category_name: plan.category_name || null,
      };

      const errors = [...plan.errors];
      let action = null;
      let message = null;

      try {
        if (!errors.length) {
          if (plan.row_type === "HEAD") {
            const headKey = CategoryMasterMigrationService.normalizeNameKey(
              plan.head_name,
            );
            const existingHead = await this._findHeadByName(plan.head_name);
            if (existingHead) {
              action = "update_or_keep";
              updateCandidates += 1;
              message = "Head already exists (will update/keep)";
            } else {
              action = "create";
              createCandidates += 1;
              virtualHeads.add(headKey);
              message = "Head will be created";
            }
          } else if (plan.row_type === "GROUP") {
            const headKey = CategoryMasterMigrationService.normalizeNameKey(
              plan.head_name,
            );
            const groupKey = `${headKey}||${CategoryMasterMigrationService.normalizeNameKey(
              plan.group_name,
            )}`;

            const existingHead = await this._findHeadByName(plan.head_name);
            const headResolvable = Boolean(existingHead) || virtualHeads.has(headKey);
            if (!headResolvable) {
              errors.push(
                `Head '${plan.head_name}' not found (add HEAD row before this GROUP or create it first)`,
              );
            } else if (existingHead) {
              const existingGroup = await this._findGroupByName(
                existingHead.id,
                plan.group_name,
              );
              if (existingGroup) {
                action = "update_or_keep";
                updateCandidates += 1;
                message = "Group already exists (will update/keep)";
              } else {
                action = "create";
                createCandidates += 1;
                virtualGroups.add(groupKey);
                message = "Group will be created";
              }
            } else {
              action = "create";
              createCandidates += 1;
              virtualGroups.add(groupKey);
              message = "Group will be created under new head from this file";
            }
          } else if (plan.row_type === "CATEGORY") {
            const headKey = CategoryMasterMigrationService.normalizeNameKey(
              plan.head_name,
            );
            const groupKey = `${headKey}||${CategoryMasterMigrationService.normalizeNameKey(
              plan.group_name,
            )}`;

            const existingHead = await this._findHeadByName(plan.head_name);
            const headResolvable = Boolean(existingHead) || virtualHeads.has(headKey);
            if (!headResolvable) {
              errors.push(
                `Head '${plan.head_name}' not found (add HEAD row before this CATEGORY or create it first)`,
              );
            }

            let groupResolvable = false;
            let existingGroup = null;
            if (headResolvable && existingHead) {
              existingGroup = await this._findGroupByName(
                existingHead.id,
                plan.group_name,
              );
              groupResolvable = Boolean(existingGroup) || virtualGroups.has(groupKey);
            } else if (headResolvable) {
              groupResolvable = virtualGroups.has(groupKey);
            }

            if (!groupResolvable) {
              errors.push(
                `Group '${plan.group_name}' not found under head '${plan.head_name}' (add GROUP row before this CATEGORY or create it first)`,
              );
            } else if (existingGroup) {
              const existingCategory = await this._findCategoryByName(
                existingGroup.id,
                plan.category_name,
              );
              if (existingCategory) {
                action = "update_or_keep";
                updateCandidates += 1;
                message = "Category already exists (will update/keep)";
              } else {
                action = "create";
                createCandidates += 1;
                message = "Category will be created";
              }
            } else {
              action = "create";
              createCandidates += 1;
              message = "Category will be created under new group from this file";
            }
          } else {
            errors.push("Unsupported row_type");
          }
        }
      } catch (error) {
        errors.push(error?.message || "Validation failed");
      }

      if (errors.length > 0) {
        failedRows += 1;
        details.push({
          ...baseDetail,
          status: "failed",
          action: null,
          message: errors.join(" | "),
        });
      } else {
        readyRows += 1;
        details.push({
          ...baseDetail,
          status: "ok",
          action,
          message,
        });
      }
    }

    return {
      success: failedRows === 0,
      summary: {
        total_rows: plans.length,
        ready_rows: readyRows,
        failed_rows: failedRows,
        create_candidates: createCandidates,
        update_candidates: updateCandidates,
      },
      details,
    };
  }

  async validate({ rows = [] }) {
    const { plans, normalizedRowsCount } = this._buildBasePlans(rows);
    const preview = await this._previewPlans(plans);
    return {
      success: preview.success,
      mode: "validate",
      summary: {
        ...preview.summary,
        total_rows: normalizedRowsCount,
      },
      details: preview.details,
    };
  }

  async execute({ rows = [] }) {
    const { plans, normalizedRowsCount } = this._buildBasePlans(rows);
    const preview = await this._previewPlans(plans);

    if (!preview.success) {
      return {
        success: false,
        mode: "execute",
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: 0,
          updated_rows: 0,
          kept_rows: 0,
          failed_rows: preview.summary.failed_rows,
        },
        details: preview.details,
      };
    }

    const transaction = await sequelize.transaction();
    try {
      const details = [];
      let createdRows = 0;
      let updatedRows = 0;
      let keptRows = 0;

      const headCache = new Map();
      const groupCache = new Map();

      const getOrCreateHead = async (headName) => {
        const headKey = CategoryMasterMigrationService.normalizeNameKey(headName);
        if (headCache.has(headKey)) {
          return headCache.get(headKey);
        }

        let head = await this._findHeadByName(headName, transaction);
        let action = "kept";

        if (!head) {
          head = await ItemCategoryHead.create(
            {
              category_head_name: headName,
            },
            { transaction },
          );
          action = "created";
        } else if (head.category_head_name !== headName) {
          await head.update({ category_head_name: headName }, { transaction });
          action = "updated";
        }

        const payload = { head, action };
        headCache.set(headKey, payload);
        return payload;
      };

      const getOrCreateGroup = async (head, groupName) => {
        const groupKey = `${head.id}||${CategoryMasterMigrationService.normalizeNameKey(
          groupName,
        )}`;
        if (groupCache.has(groupKey)) {
          return groupCache.get(groupKey);
        }

        let group = await this._findGroupByName(head.id, groupName, transaction);
        let action = "kept";

        if (!group) {
          group = await ItemCategoryGroup.create(
            {
              category_group_name: groupName,
              head_id: head.id,
            },
            { transaction },
          );
          action = "created";
        } else if (
          group.category_group_name !== groupName ||
          Number(group.head_id) !== Number(head.id)
        ) {
          await group.update(
            {
              category_group_name: groupName,
              head_id: head.id,
            },
            { transaction },
          );
          action = "updated";
        }

        const payload = { group, action };
        groupCache.set(groupKey, payload);
        return payload;
      };

      for (const plan of plans) {
        const baseDetail = {
          sheet: plan.row.sheet_name || "category_master",
          row_no: plan.row.row_no,
          row_type: plan.row_type,
          head_name: plan.head_name || null,
          group_name: plan.group_name || null,
          category_name: plan.category_name || null,
        };

        if (plan.row_type === "HEAD") {
          const { action } = await getOrCreateHead(plan.head_name);
          if (action === "created") createdRows += 1;
          else if (action === "updated") updatedRows += 1;
          else keptRows += 1;

          details.push({
            ...baseDetail,
            status: "imported",
            action,
            message: `HEAD ${action}`,
          });
          continue;
        }

        if (plan.row_type === "GROUP") {
          const { head } = await getOrCreateHead(plan.head_name);
          const { action } = await getOrCreateGroup(head, plan.group_name);

          if (action === "created") createdRows += 1;
          else if (action === "updated") updatedRows += 1;
          else keptRows += 1;

          details.push({
            ...baseDetail,
            status: "imported",
            action,
            message: `GROUP ${action}`,
          });
          continue;
        }

        if (plan.row_type === "CATEGORY") {
          const { head } = await getOrCreateHead(plan.head_name);
          const { group } = await getOrCreateGroup(head, plan.group_name);

          let category = await this._findCategoryByName(
            group.id,
            plan.category_name,
            transaction,
          );
          let action = "kept";

          if (!category) {
            category = await ItemCategory.create(
              {
                category_name: plan.category_name,
                group_id: group.id,
                serialized_required: plan.serialized_required,
              },
              { transaction },
            );
            action = "created";
          } else {
            const patch = {};
            if (category.category_name !== plan.category_name) {
              patch.category_name = plan.category_name;
            }
            if (Number(category.group_id) !== Number(group.id)) {
              patch.group_id = group.id;
            }
            if (Boolean(category.serialized_required) !== Boolean(plan.serialized_required)) {
              patch.serialized_required = Boolean(plan.serialized_required);
            }
            if (Object.keys(patch).length > 0) {
              await category.update(patch, { transaction });
              action = "updated";
            }
          }

          if (action === "created") createdRows += 1;
          else if (action === "updated") updatedRows += 1;
          else keptRows += 1;

          details.push({
            ...baseDetail,
            serialized_required: Boolean(plan.serialized_required),
            status: "imported",
            action,
            message: `CATEGORY ${action}`,
          });
          continue;
        }

        throw new Error(`Unsupported row_type '${plan.row_type || "UNKNOWN"}'`);
      }

      await transaction.commit();
      return {
        success: true,
        mode: "execute",
        summary: {
          total_rows: normalizedRowsCount,
          created_rows: createdRows,
          updated_rows: updatedRows,
          kept_rows: keptRows,
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
          updated_rows: 0,
          kept_rows: 0,
          failed_rows: normalizedRowsCount,
        },
        details: plans.map((plan) => ({
          sheet: plan.row.sheet_name || "category_master",
          row_no: plan.row.row_no,
          row_type: plan.row_type || null,
          head_name: plan.head_name || null,
          group_name: plan.group_name || null,
          category_name: plan.category_name || null,
          status: "failed",
          action: null,
          message: `Batch rolled back: ${error?.message || "Execution failed"}`,
        })),
      };
    }
  }
}

module.exports = {
  CategoryMasterMigrationService,
};

