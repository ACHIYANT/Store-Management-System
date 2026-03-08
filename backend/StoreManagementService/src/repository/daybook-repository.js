// ! Repository folder is to have the interactions with the model and database.
// import { where } from "sequelize";
// import { Vendor } from "../models/index";

const {
  DayBook,
  DayBookItem,
  DayBookItemSerial,
  Stock,
  DayBookAdditionalCharge,
  Vendors,
  ItemCategory,
  ItemCategoryGroup,
  ItemCategoryHead,
} = require("../models/index");
const { Op } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyDateIdDescCursor,
} = require("../utils/cursor-pagination");

const axios = require("axios");
const { AUTH_BASE_URL } = require("../config/serverConfig");

const APPROVER_TOKEN = "|";

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeApproverIds(serialized) {
  if (!serialized || typeof serialized !== "string") return [];
  return serialized
    .split(APPROVER_TOKEN)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => toNumber(part))
    .filter((n) => Number.isFinite(n));
}

function addApproverId(serialized, userId) {
  const id = toNumber(userId);
  if (!Number.isFinite(id)) return serialized || null;
  const merged = new Set([...normalizeApproverIds(serialized), id]);
  if (merged.size === 0) return null;
  return `${APPROVER_TOKEN}${[...merged].sort((a, b) => a - b).join(APPROVER_TOKEN)}${APPROVER_TOKEN}`;
}

function buildScopedVisibilityConditions({ viewerUserId, viewerRoleStageOrders }) {
  const conditions = [];
  const numericUserId = toNumber(viewerUserId);

  if (Number.isFinite(numericUserId)) {
    conditions.push({ created_by_user_id: numericUserId });
    conditions.push({
      approved_by_user_ids: { [Op.like]: `%${APPROVER_TOKEN}${numericUserId}${APPROVER_TOKEN}%` },
    });
  }

  const stageOrders = Array.isArray(viewerRoleStageOrders)
    ? viewerRoleStageOrders
        .map((order) => toNumber(order))
        .filter((order) => Number.isFinite(order))
    : [];

  if (stageOrders.length > 0) {
    conditions.push({
      approval_level: {
        [Op.in]: [...new Set(stageOrders)],
      },
    });
  }

  return conditions;
}

class DayBookRepository {
  async createDayBook(data, transaction) {
    try {
      console.log(
        "Trying to create Day Book in the try block of repository layer.",
      );
      const daybook = await DayBook.create(data, { transaction });
      return daybook;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async deleteDayBook(dayBookId) {
    try {
      await DayBook.destroy({
        where: {
          id: dayBookId,
        },
      });
      return true;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async updateDayBook(dayBookId, data) {
    try {
      // 🔍 Fetch existing record
      const existingDayBook = await DayBook.findByPk(dayBookId);

      if (!existingDayBook) {
        throw new Error("DayBook not found");
      }

      // 🚫 If MRN already generated → block update
      if (existingDayBook.mrn_security_code) {
        throw new Error(
          "MRN already generated. Please cancel MRN before updating the DayBook.",
        );
      }

      // ✅ MRN not generated → allow update and reset workflow
      const dataToUpdate = {
        ...data,
        approval_level: 0,
        status: "Pending",
      };

      return sequelize.transaction(async (t) => {
        await DayBook.update(dataToUpdate, {
          where: { id: dayBookId },
          transaction: t,
        });
        if (updatedRowsCount === 0) {
          throw new Error("No changes were made");
        }

        return await DayBook.findByPk(dayBookId, { transaction: t });
      });

      // const [updatedRowsCount] = await DayBook.update(dataToUpdate, {
      //   where: { id: dayBookId },
      // });
      // if (updatedRowsCount === 0) {
      //     throw new Error("No changes were made");
      //   }
      // const updatedDayBook = await DayBook.findByPk(dayBookId);
      // return updatedDayBook;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.message ||
        "Update failed";

      // alert(message);
      // console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getDayBookById(id) {
    try {
      //   const vendor = await Vendor.findByPk(vendorId);
      const dayBook = await DayBook.findOne({
        where: {
          id: id, // 'gst' should match the column name in your model
        },
      });
      return dayBook;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  // If level/isStoreEntry provided, filter by approval_level unless store should see all
  // async getAllDayBooksByLevel(level = null, isStoreEntry = false, entryNo="") {
  //   try {
  //     const whereClause = {};

  //     // If not store-entry and level provided, only return that approval_level
  //     if (!isStoreEntry && level !== null) {
  //       whereClause.approval_level = level;
  //     }

  //     const dayBooks = await DayBook.findAll({ where: whereClause });
  //     return dayBooks;
  //   } catch (error) {
  //     console.log("Something went wrong in the repository layer.");
  //     throw { error };
  //   }
  // }

  // async getAllDayBooksByLevel(level = null, isStoreEntry = false, entryNo = "") {
  async getAllDayBooksByLevel(filters) {
    try {
      const {
        lvll,
        storeFlag,
        entryNo,
        finYear,
        status,
        entryType,
        page,
        limit,
        cursor,
        cursorMode,
        enforceStageInbox = false,
        applyOwnershipScope = false,
        viewerUserId = null,
        viewerRoleStageOrders = [],
      } = filters;
      const whereClause = {};
      console.log(
        "repo:level",
        lvll,
        storeFlag,
        entryNo,
        finYear,
        status,
        entryType,
        page,
        limit,
        cursor,
        cursorMode,
      );

      // ✅ Legacy role based filtering (kept for backward compatibility)
      if (!enforceStageInbox && !applyOwnershipScope && !storeFlag && lvll !== null) {
        whereClause.approval_level = lvll;
      }

      // ✅ Entry number search (partial match)
      if (entryNo && entryNo.trim()) {
        whereClause.entry_no = {
          [Op.like]: `%${entryNo.trim()}%`,
        };
      }

      // 🔹 Financial year
      if (finYear) {
        whereClause.fin_year = finYear;
      }

      // 🔹 Status
      if (status) {
        whereClause.status = status;
      }

      // 🔹 Entry type
      if (entryType) {
        whereClause.entry_type = entryType;
      }

      if (enforceStageInbox) {
        const stageOrders = Array.isArray(viewerRoleStageOrders)
          ? viewerRoleStageOrders
              .map((order) => toNumber(order))
              .filter((order) => Number.isFinite(order))
          : [];

        if (!stageOrders.length) {
          whereClause.id = -1;
        } else {
          whereClause.approval_level = { [Op.in]: [...new Set(stageOrders)] };
          whereClause.status = "Pending";
        }
      }

      if (applyOwnershipScope) {
        const scopedConditions = buildScopedVisibilityConditions({
          viewerUserId,
          viewerRoleStageOrders,
        });

        if (scopedConditions.length > 0) {
          whereClause[Op.and] = [{ [Op.or]: scopedConditions }];
        }
      }

      const parseCursor = (rawCursor) => {
        if (!rawCursor) return null;
        try {
          const decoded = Buffer.from(String(rawCursor), "base64").toString("utf8");
          const payload = JSON.parse(decoded);
          if (!payload?.createdAt || payload?.id == null) return null;
          const createdAtDate = new Date(payload.createdAt);
          if (Number.isNaN(createdAtDate.getTime())) return null;
          const idNum = Number(payload.id);
          if (!Number.isFinite(idNum)) return null;
          return { createdAt: createdAtDate, id: idNum };
        } catch (error) {
          return null;
        }
      };

      const encodeCursor = (row) => {
        const payload = JSON.stringify({
          createdAt: row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt).toISOString(),
          id: row.id,
        });
        return Buffer.from(payload, "utf8").toString("base64");
      };

      const query = {
        where: whereClause,
        order: [
          ["createdAt", "DESC"],
          ["id", "DESC"],
        ],
      };

      const hasCursorPagination =
        Boolean(cursorMode) &&
        Number.isInteger(limit) &&
        limit > 0;

      if (hasCursorPagination) {
        const cursorParts = parseCursor(cursor);
        const cursorWhere = { ...whereClause };

        if (cursorParts) {
          cursorWhere[Op.or] = [
            { createdAt: { [Op.lt]: cursorParts.createdAt } },
            {
              createdAt: cursorParts.createdAt,
              id: { [Op.lt]: cursorParts.id },
            },
          ];
        }

        const rowsWithExtra = await DayBook.findAll({
          ...query,
          where: cursorWhere,
          limit: limit + 1,
        });

        const hasMore = rowsWithExtra.length > limit;
        const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
        const nextCursor =
          hasMore && rows.length > 0 ? encodeCursor(rows[rows.length - 1]) : null;

        return {
          rows,
          meta: {
            limit,
            hasMore,
            nextCursor,
            mode: "cursor",
          },
        };
      }

      const hasPagination =
        Number.isInteger(page) &&
        Number.isInteger(limit) &&
        page > 0 &&
        limit > 0;

      if (!hasPagination) {
        return await DayBook.findAll(query);
      }

      const offset = (page - 1) * limit;
      const { rows, count } = await DayBook.findAndCountAll({
        ...query,
        limit,
        offset,
      });

      const totalPages = count === 0 ? 0 : Math.ceil(count / limit);

      return {
        rows,
        meta: {
          page,
          limit,
          total: count,
          totalPages,
          hasMore: page < totalPages,
          mode: "offset",
        },
      };
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw error;
    }
  }

  async getDayBookForMrn(options = {}) {
    try {
      const {
        applyOwnershipScope = false,
        viewerUserId = null,
        viewerRoleStageOrders = [],
      } = options;

      const whereClause = {
        status: "Approved",
      };

      if (applyOwnershipScope) {
        const scopedConditions = buildScopedVisibilityConditions({
          viewerUserId,
          viewerRoleStageOrders,
        });
        if (scopedConditions.length > 0) {
          whereClause[Op.and] = [{ [Op.or]: scopedConditions }];
        }
      }

      const dayBook = await DayBook.findAll({
        where: whereClause,
        order: [["createdAt", "DESC"]],
      });
      return dayBook;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw error;
    }
  }

  async searchDayBookByEntryNo(entryNo, level = null, isStoreEntry = false) {
    try {
      const options =
        typeof level === "object" && level !== null
          ? level
          : {
              level,
              isStoreEntry,
            };

      const {
        level: resolvedLevel = null,
        isStoreEntry: resolvedStoreEntry = false,
        enforceStageInbox = false,
        applyOwnershipScope = false,
        viewerUserId = null,
        viewerRoleStageOrders = [],
      } = options;

      const whereClause = {
        entry_no: {
          [Op.like]: `%${entryNo}%`, // partial match
        },
      };

      // If NOT store entry, restrict by approval_level
      if (
        !enforceStageInbox &&
        !applyOwnershipScope &&
        !resolvedStoreEntry &&
        resolvedLevel !== null
      ) {
        whereClause.approval_level = resolvedLevel;
      }

      if (enforceStageInbox) {
        const stageOrders = Array.isArray(viewerRoleStageOrders)
          ? viewerRoleStageOrders
              .map((order) => toNumber(order))
              .filter((order) => Number.isFinite(order))
          : [];

        if (!stageOrders.length) {
          whereClause.id = -1;
        } else {
          whereClause.approval_level = { [Op.in]: [...new Set(stageOrders)] };
          whereClause.status = "Pending";
        }
      }

      if (applyOwnershipScope) {
        const scopedConditions = buildScopedVisibilityConditions({
          viewerUserId,
          viewerRoleStageOrders,
        });
        if (scopedConditions.length > 0) {
          whereClause[Op.and] = [{ [Op.or]: scopedConditions }];
        }
      }

      const dayBooks = await DayBook.findAll({ where: whereClause });
      return dayBooks;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getLastEntryForType(entry_type, fin_year) {
    // const { entry_type, fin_year } = {entry_type, fin_year};
    try {
      const prefix = getPrefix(entry_type); // e.g., "CI"
      const yearPrefix = `${prefix}-${fin_year}/`;

      const lastEntry = await DayBook.findOne({
        where: {
          entry_type: entry_type,
          fin_year: parseInt(fin_year),
          entry_no: {
            [Op.startsWith]: yearPrefix,
          },
        },
        order: [["createdAt", "DESC"]],
      });

      let last_serial = 0;
      if (lastEntry && lastEntry.entry_no) {
        const parts = lastEntry.entry_no.split("/");
        if (parts.length === 2) {
          last_serial = parseInt(parts[1]) || 0;
        }
      }

      return last_serial;
    } catch (error) {
      console.error("Error fetching last entry:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  // Approve DayBook to next stage
  // ! The below function is use for moving the daybook entry to the next stage by checking the active stages and the currect stage fo the daybook if still there is any left stage then it will push the daybook to the next stage.
  async advanceApprovalUsingStages(id, transaction = null, approverUserId = null) {
    const daybook = await DayBook.findByPk(id, { transaction });
    if (!daybook) throw new Error("DayBook not found");

    // Fetch approval stages from AuthService
    const { data } = await axios.get(
      `${AUTH_BASE_URL}/approval/stages`,
      { params: { flow_type: "DAYBOOK" } },
    );

    const stages = (data.data || []).filter((s) => s.active);

    const currentOrder = daybook.approval_level || 0;

    const nextStage = stages.find((s) => s.stage_order > currentOrder);
    console.log(nextStage);
    if (nextStage) {
      daybook.approval_level = nextStage.stage_order;
      daybook.status = "Pending";
    } else {
      daybook.status = "Approved"; // Final stage
    }

    daybook.approved_by_user_ids = addApproverId(
      daybook.approved_by_user_ids,
      approverUserId,
    );

    await daybook.save({ transaction });
    return daybook;
  }

  async rejectToStore(id, remarks = null) {
    const daybook = await DayBook.findByPk(id);
    if (!daybook) throw new Error("DayBook not found");

    daybook.approval_level = 0;
    daybook.status = "Rejected";
    if (remarks) daybook.remarks = remarks;

    await daybook.save();
    return daybook;
  }

  async getDayBookForMrnCancellation(daybookId, transaction) {
    try {
      return await DayBook.findByPk(daybookId, {
        include: [
          {
            model: DayBookItem,
            include: [{ model: DayBookItemSerial }, { model: Stock }],
          },
        ],
        transaction,
        lock: transaction?.LOCK.UPDATE,
      });
    } catch (error) {
      console.log("Error fetching DayBook for MRN cancellation");
      throw error;
    }
  }
  async getDayBookFullDetails(daybookId) {
    return DayBook.findByPk(daybookId, {
      include: [
        {
          model: DayBookItem,

          include: [
            {
              model: ItemCategory,
              // as: "category",
              attributes: ["id", "category_name", "group_id"],
              include: [
                {
                  model: ItemCategoryGroup,
                  as: "group",
                  attributes: ["id", "category_group_name", "head_id"],
                  include: [
                    {
                      model: ItemCategoryHead,
                      as: "head",
                      attributes: ["id", "category_head_name"],
                    },
                  ],
                },
              ],
            },
            {
              model: DayBookItemSerial,
            },
          ],
        },
        {
          model: DayBookAdditionalCharge,
        },
        {
          model: Vendors,
        },
      ],
    });
  }

  async updateById(id, data, transaction = null) {
    return DayBook.update(data, {
      where: { id },
      transaction,
    });
  }

  async getMrnWithFilters({
    search,
    finYear,
    status,
    entryType,
    page = null,
    limit = null,
    cursor = null,
    cursorMode = false,
    applyOwnershipScope = false,
    viewerUserId = null,
    viewerRoleStageOrders = [],
  }) {
    try {
      const where = {
        // approval_level: 3, // MRN condition
        // status: "Approved", // or whatever your MRN logic is
        status: {
          [Op.in]: ["Approved", "MRN Cancelled"],
        },
      };

      if (search) {
        where.entry_no = { [Op.like]: `%${search}%` };
      }

      if (finYear) {
        where.fin_year = finYear;
      }

      if (status) {
        where.status = status;
      }

      if (entryType) {
        where.entry_type = entryType;
      }

      if (applyOwnershipScope) {
        const scopedConditions = buildScopedVisibilityConditions({
          viewerUserId,
          viewerRoleStageOrders,
        });
        if (scopedConditions.length > 0) {
          where[Op.and] = [{ [Op.or]: scopedConditions }];
        }
      }

      const order = [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ];
      const useCursorMode = Boolean(cursorMode) && limit != null;

      if (useCursorMode) {
        const safeLimit = normalizeLimit(limit, 100, 500);
        const cursorParts = decodeCursor(cursor);
        const cursorWhere = applyDateIdDescCursor(where, cursorParts, "createdAt", "id");

        const rowsWithExtra = await DayBook.findAll({
          where: cursorWhere,
          order,
          limit: safeLimit + 1,
        });
        const hasMore = rowsWithExtra.length > safeLimit;
        const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
        const nextCursor =
          hasMore && rows.length
            ? encodeCursor({
                createdAt:
                  rows[rows.length - 1].createdAt instanceof Date
                    ? rows[rows.length - 1].createdAt.toISOString()
                    : new Date(rows[rows.length - 1].createdAt).toISOString(),
                id: rows[rows.length - 1].id,
              })
            : null;

        return {
          rows,
          meta: {
            limit: safeLimit,
            hasMore,
            nextCursor,
            mode: "cursor",
          },
        };
      }

      const safePage =
        Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : null;
      const safeLimit =
        Number.isFinite(Number(limit)) && Number(limit) > 0
          ? normalizeLimit(limit, 100, 500)
          : null;

      if (safePage && safeLimit) {
        const offset = (safePage - 1) * safeLimit;
        const { rows, count } = await DayBook.findAndCountAll({
          where,
          order,
          limit: safeLimit,
          offset,
        });
        const totalPages = count === 0 ? 0 : Math.ceil(count / safeLimit);
        return {
          rows,
          meta: {
            page: safePage,
            limit: safeLimit,
            total: count,
            totalPages,
            hasMore: safePage < totalPages,
            mode: "offset",
          },
        };
      }

      return await DayBook.findAll({
        where,
        order,
      });
    } catch (error) {
      console.log("Repository error: getMrnWithFilters");
      throw error;
    }
  }
}

const getPrefix = (entryType) => {
  switch (entryType) {
    case "Consumable Items":
      return "CI";
    case "Fixed Assets":
      return "FA";
    case "Vehicle Items":
      return "VI";
    case "Stationary Items":
      return "SI";
    default:
      return "ET";
  }
};

module.exports = DayBookRepository;
