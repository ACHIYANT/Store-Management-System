const { DayBookRepository } = require("../repository/index");
const { computeNextStage } = require("../utils/approval-flow");
const DayBookAdditionalChargeRepository = require("../repository/daybook-additional-charge-repository");
const { generateMrnSecurityCode } = require("../utils/mrnSecurityCode");
const axios = require("axios");
const { AUTH_BASE_URL } = require("../config/serverConfig");

const { sequelize, Asset } = require("../models");
const AssetEventService = require("./assetevent-service");
const StockService = require("./stock-service");
const AssetService = require("./asset-service");
// const DayBookEntrySequenceService = require("./daybook-entry-sequence-service");
const DayBookEntrySequenceService = require("./daybook-entry-sequence-service");
const DayBookItemService = require("./daybookitem-service");
const DayBookItemSerialService = require("./daybookitemserials-service");

const { renameUploadedFiles } = require("../utils/rename-upload-files");
const {
  assertActorCanAccessLocation,
  resolveActorLocationScope,
} = require("../utils/location-scope");

class DayBookService {
  constructor() {
    this.daybookRepository = new DayBookRepository();
    this.additionalChargeRepository = new DayBookAdditionalChargeRepository();
    this.stageCache = {
      at: 0,
      stages: [],
    };
  }

  normalizeRoles(roles) {
    return Array.isArray(roles)
      ? roles.map((role) => String(role || "").toUpperCase()).filter(Boolean)
      : [];
  }

  getActorDaybookStageAccess(roles = []) {
    const normalized = this.normalizeRoles(roles);
    const isSuperAdmin = normalized.includes("SUPER_ADMIN");
    const isStoreEntry = normalized.includes("STORE_ENTRY");

    return {
      normalized,
      isSuperAdmin,
      isStoreEntry,
    };
  }

  isPrivilegedViewer(roles = []) {
    const normalized = this.normalizeRoles(roles);
    return (
      normalized.includes("STORE_ENTRY") || normalized.includes("SUPER_ADMIN")
    );
  }

  async assertActorCanAdvanceDaybook(daybook, actor = null) {
    const { normalized, isSuperAdmin, isStoreEntry } = this.getActorDaybookStageAccess(
      actor?.roles || [],
    );

    if (isSuperAdmin) return;

    const currentLevel = Number(daybook?.approval_level || 0);

    if (isStoreEntry) {
      if (currentLevel === 0) return;
      const error = new Error("Only the current approver can move this daybook.");
      error.statusCode = 403;
      throw error;
    }

    const roleStageOrders = await this.getRoleStageOrders(normalized);
    if (roleStageOrders.includes(currentLevel)) {
      return;
    }

    const error = new Error("Only the current approver can move this daybook.");
    error.statusCode = 403;
    throw error;
  }

  async assertActorCanRejectDaybook(daybook, actor = null) {
    const { normalized, isSuperAdmin, isStoreEntry } = this.getActorDaybookStageAccess(
      actor?.roles || [],
    );

    if (isSuperAdmin) return;
    if (isStoreEntry) {
      const error = new Error("Store entry cannot reject this daybook.");
      error.statusCode = 403;
      throw error;
    }

    const currentLevel = Number(daybook?.approval_level || 0);
    const roleStageOrders = await this.getRoleStageOrders(normalized);
    if (roleStageOrders.includes(currentLevel)) {
      return;
    }

    const error = new Error("Only the current approver can reject this daybook.");
    error.statusCode = 403;
    throw error;
  }

  async getRoleStageOrders(roles = []) {
    const normalizedRoles = this.normalizeRoles(roles);
    if (!normalizedRoles.length) return [];

    const now = Date.now();
    const cacheTtlMs = 60 * 1000;

    if (!this.stageCache.at || now - this.stageCache.at > cacheTtlMs) {
      try {
        const response = await axios.get(`${AUTH_BASE_URL}/approval/stages`, {
          params: { flow_type: "DAYBOOK" },
        });
        const stages = Array.isArray(response?.data?.data)
          ? response.data.data
          : [];
        this.stageCache = {
          at: now,
          stages,
        };
      } catch {
        this.stageCache = {
          at: now,
          stages: [],
        };
      }
    }

    const orders = this.stageCache.stages
      .filter((stage) =>
        normalizedRoles.includes(String(stage?.role_name || "").toUpperCase()),
      )
      .map((stage) => Number(stage.stage_order))
      .filter((n) => Number.isFinite(n));

    return [...new Set(orders)];
  }

  async createDayBook(data, actor = null) {
    try {
      const payload = { ...data };
      const numericUserId = Number(actor?.id);
      if (Number.isFinite(numericUserId)) {
        payload.created_by_user_id = numericUserId;
      }
      payload.location_scope = resolveActorLocationScope(
        actor || {},
        payload.location_scope || payload.location,
      );
      const daybook = await this.daybookRepository.createDayBook(payload);
      return daybook;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async createFullDayBook(payload, actor = null) {
    const transaction = await sequelize.transaction();
    const entrySequenceService = new DayBookEntrySequenceService();
    const dayBookItemService = new DayBookItemService();
    const dayBookItemSerialService = new DayBookItemSerialService();
    try {
      const {
        entry_type, // FA / CI / SI / VI
        fin_year,
        daybook,
        items = [],
        additionalCharges = [],
        serials = [],
      } = payload;

      // 1️⃣ Generate entry number (LOCKED & SAFE)
      const entryNo = await entrySequenceService.generateNextEntryNo(
        entry_type,
        fin_year,
        transaction,
      );

      // 2️⃣ Create DayBook
      const createdDayBook = await this.daybookRepository.createDayBook(
        {
          ...daybook,
          entry_no: entryNo,
          entry_type,
          fin_year,
          location_scope: resolveActorLocationScope(
            actor || {},
            daybook?.location_scope || daybook?.location,
          ),
          ...(Number.isFinite(Number(actor?.id))
            ? { created_by_user_id: Number(actor.id) }
            : {}),
        },
        transaction,
      );

      // 3️⃣ Create Items + Charges
      const createdItems = await dayBookItemService.createItemsAndCharges(
        createdDayBook.id,
        items,
        additionalCharges,
        transaction,
      );

      // 4️⃣ Create Serials (optional)
      if (Array.isArray(serials) && serials.length > 0) {
        await dayBookItemSerialService.bulkUpsertAll(
          createdItems,
          serials,
          transaction,
          entryNo,
        );
      }

      await transaction.commit();

      setImmediate(async () => {
        try {
          const renamed = renameUploadedFiles({
            entryNo,
            billNo: daybook.bill_no,
          });

          const updatePayload = {};

          if (renamed.bills) {
            updatePayload.bill_image_url = renamed.bills;
          }

          if (renamed.items) {
            updatePayload.item_image_url = renamed.items;
          }

          if (Object.keys(updatePayload).length > 0) {
            await this.daybookRepository.updateById(
              createdDayBook.id,
              updatePayload,
            );
          }
        } catch (err) {
          console.error("Post-commit file rename failed:", err);
        }
      });

      return {
        daybook_id: createdDayBook.id,
        entry_no: entryNo,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  async deleteDayBook(dayBookId) {
    try {
      const response = await this.daybookRepository.deleteDayBook(dayBookId);
      return response;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async updateDaybook(dayBookId, data) {
    try {
      const dayBook = await this.daybookRepository.updateDayBook(
        dayBookId,
        data,
      );
      return dayBook;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async updateDayBookNew(daybookId, payload, actor = null) {
    try {
      const existingDaybook = await this.daybookRepository.getDayBookById(
        daybookId,
      );
      if (!existingDaybook) {
        const error = new Error("DayBook not found");
        error.statusCode = 404;
        throw error;
      }

      assertActorCanAccessLocation(
        actor || {},
        existingDaybook.location_scope,
        "update this daybook",
      );

      if (existingDaybook.mrn_security_code) {
        const error = new Error(
          "MRN already generated. Please cancel MRN before updating the DayBook.",
        );
        error.statusCode = 409;
        throw error;
      }

      const allowedFields = [
        "bill_no",
        "bill_date",
        "remarks",
        "vendor_id",
        "total_amount",
      ];

      const updatePayload = {};

      allowedFields.forEach((field) => {
        if (payload[field] !== undefined) {
          updatePayload[field] = payload[field];
        }
      });

      await this.daybookRepository.updateById(daybookId, updatePayload);

      return this.daybookRepository.getDayBookById(daybookId);
    } catch (error) {
      console.error("updateDayBook service error:", error);
      throw error;
    }
  }

  async getDayBookById(id, actor = null) {
    try {
      const dayBook = await this.daybookRepository.getDayBookById(id);
      if (dayBook) {
        assertActorCanAccessLocation(
          actor || {},
          dayBook.location_scope,
          "access daybooks for this location",
        );
      }
      return dayBook;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  // ! Helper function to help filters based on the role
  getAllowedFiltersByRole(level, isStoreEntry) {
    if (isStoreEntry) {
      return {
        finYear: true,
        status: true,
        entryType: true,
      };
    }

    if (level === 0) {
      return { finYear: true, status: true, entryType: true };
    }

    if (level === 1) {
      return { finYear: false, status: true, entryType: true };
    }

    if (level === 2) {
      return { finYear: false, status: true, entryType: false };
    }

    return { finYear: false, status: false, entryType: false };
  }

  // New: getAllDayBooks with optional role filters
  // async getAllDayBooksByLevel(level = null, isStoreEntry = false, entryNo="") {
  async getAllDayBooksByLevel(filters) {
    try {
      const {
        entryNo,
        finYear,
        status,
        entryType,
        page,
        limit,
        cursor,
        cursorMode,
        viewerUserId = null,
        viewerRoles = [],
        viewerAssignments = [],
        viewerLocationScopes = [],
      } = filters;
      console.log(
        "service:level",
        entryNo,
        finYear,
        status,
        entryType,
        page,
        limit,
        cursor,
        cursorMode,
      );
      const normalizedRoles = this.normalizeRoles(viewerRoles);
      const hasPrivilegedRole = this.isPrivilegedViewer(normalizedRoles);
      const numericViewerUserId = Number(viewerUserId);
      console.log(numericViewerUserId);
      const roleStageOrders =
        !hasPrivilegedRole && normalizedRoles.length > 0
          ? await this.getRoleStageOrders(normalizedRoles)
          : [];
      const enforceStageInbox =
        !hasPrivilegedRole && roleStageOrders.length > 0;
      const applyOwnershipScope =
        !enforceStageInbox &&
        Number.isFinite(numericViewerUserId) &&
        normalizedRoles.length > 0 &&
        !hasPrivilegedRole;

      const lvll = null;
      const storeFlag = hasPrivilegedRole;
      // 🔐 Enforce permissions
      const allowedFilters = this.getAllowedFiltersByRole(lvll, storeFlag);

      const safeFilters = {
        entryNo,
        page,
        limit,
        cursor,
        cursorMode,
        enforceStageInbox,
        applyOwnershipScope,
        viewerUserId: Number.isFinite(numericViewerUserId)
          ? numericViewerUserId
          : null,
        viewerRoleStageOrders: roleStageOrders,
        viewerActor: {
          id: Number.isFinite(numericViewerUserId) ? numericViewerUserId : null,
          roles: normalizedRoles,
          assignments: viewerAssignments,
          location_scopes: viewerLocationScopes,
        },
      };

      if (allowedFilters.finYear) safeFilters.finYear = finYear;
      if (allowedFilters.status) safeFilters.status = status;
      if (allowedFilters.entryType) safeFilters.entryType = entryType;

      console.log("safeFilters", safeFilters);
      const dayBooks = await this.daybookRepository.getAllDayBooksByLevel({
        lvll,
        storeFlag,
        ...safeFilters,
      });
      return dayBooks;
    } catch (error) {
      console.log(
        "Something went wrong at service layer (getAllDayBooksByLevel).",
      );
      throw { error };
    }
  }

  async getDayBookForMrn(viewerContext = {}) {
    try {
      const normalizedRoles = this.normalizeRoles(viewerContext.viewerRoles);
      const hasPrivilegedRole = this.isPrivilegedViewer(normalizedRoles);
      const numericViewerUserId = Number(viewerContext.viewerUserId);
      const applyOwnershipScope =
        Number.isFinite(numericViewerUserId) &&
        normalizedRoles.length > 0 &&
        !hasPrivilegedRole;
      const roleStageOrders = applyOwnershipScope
        ? await this.getRoleStageOrders(normalizedRoles)
        : [];

      const dayBooks = await this.daybookRepository.getDayBookForMrn({
        applyOwnershipScope,
        viewerUserId: Number.isFinite(numericViewerUserId)
          ? numericViewerUserId
          : null,
        viewerRoleStageOrders: roleStageOrders,
        viewerActor: {
          id: Number.isFinite(numericViewerUserId) ? numericViewerUserId : null,
          roles: normalizedRoles,
          assignments: viewerContext.viewerAssignments || [],
          location_scopes: viewerContext.viewerLocationScopes || [],
        },
      });
      return dayBooks;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }
  // Search daybooks by entryNo with optional role-based filters
  async searchDayBookByEntryNo(entryNo = "", viewerContext = {}) {
    try {
      // normalize inputs
      const q = entryNo == null ? "" : String(entryNo);
      const normalizedRoles = this.normalizeRoles(viewerContext.viewerRoles);
      const hasPrivilegedRole = this.isPrivilegedViewer(normalizedRoles);
      const numericViewerUserId = Number(viewerContext.viewerUserId);
      const roleStageOrders =
        !hasPrivilegedRole && normalizedRoles.length > 0
          ? await this.getRoleStageOrders(normalizedRoles)
          : [];
      const enforceStageInbox =
        !hasPrivilegedRole && roleStageOrders.length > 0;
      const applyOwnershipScope =
        !enforceStageInbox &&
        Number.isFinite(numericViewerUserId) &&
        normalizedRoles.length > 0 &&
        !hasPrivilegedRole;

      const dayBooks = await this.daybookRepository.searchDayBookByEntryNo(q, {
        level: null,
        isStoreEntry: hasPrivilegedRole,
        enforceStageInbox,
        applyOwnershipScope,
        viewerUserId: Number.isFinite(numericViewerUserId)
          ? numericViewerUserId
          : null,
        viewerRoleStageOrders: roleStageOrders,
        viewerActor: {
          id: Number.isFinite(numericViewerUserId) ? numericViewerUserId : null,
          roles: normalizedRoles,
          assignments: viewerContext.viewerAssignments || [],
          location_scopes: viewerContext.viewerLocationScopes || [],
        },
      });
      return dayBooks;
    } catch (error) {
      console.log(
        "Something went wrong at service layer (searchDayBookByEntryNo).",
      );
      throw { error };
    }
  }

  async getLastEntryForType(entry_type, fin_year) {
    try {
      const daybook = await this.daybookRepository.getLastEntryForType(
        entry_type,
        fin_year,
      );
      return daybook;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async advanceApprovalUsingStages(id, actor = null) {
    const stockService = new StockService();
    const assetService = new AssetService();
    try {
      return await sequelize.transaction(async (t) => {
        const existingDaybook = await this.daybookRepository.getDayBookById(id);
        if (!existingDaybook) {
          throw new Error("DayBook not found");
        }
        assertActorCanAccessLocation(
          actor || {},
          existingDaybook.location_scope,
          "approve this daybook",
        );
        await this.assertActorCanAdvanceDaybook(existingDaybook, actor || {});
        // ? Step - 1 : Advance Approval - Sent daybook to next stage.
        const daybook = await this.daybookRepository.advanceApprovalUsingStages(
          id,
          t,
          actor?.id || null,
        );

        // ? Step - 2 : 🔐 Generate MRN security code ONLY on final approval
        if (daybook.status === "Approved" && !daybook.mrn_security_code) {
          const securityCode = generateMrnSecurityCode({
            entryNo: daybook.entry_no,
            daybookId: daybook.id,
          });

          await daybook.update(
            {
              mrn_security_code: securityCode,
            },
            { transaction: t },
          );
        }

        // ? ✅ Step - 3: If final approval → create stock + assets
        if (daybook.status === "Approved") {
          console.log("i am going inside the stock a");
        }
        if (daybook.status === "Approved") {
          await stockService.moveDayBookItemsToStock(
            daybook.id,
            t,
            actor || null,
          );
          await assetService.finalizeApprovedDaybook(
            daybook.id,
            t,
            actor || null,
          );
        }
        return daybook;
      });
    } catch (error) {
      console.log("Something went wrong at service layer : DayBook.");
      throw error;
    }
  }

  async rejectToStore(id, remarks = null, actor = null) {
    try {
      const existingDaybook = await this.daybookRepository.getDayBookById(id);
      if (!existingDaybook) {
        throw new Error("DayBook not found");
      }
      assertActorCanAccessLocation(
        actor || {},
        existingDaybook.location_scope,
        "reject this daybook",
      );
      await this.assertActorCanRejectDaybook(existingDaybook, actor || {});
      const record = await this.daybookRepository.rejectToStore(id, remarks);
      return record;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async cancelMrn(daybookId, confirmedNonSerialized = false, actor = null) {
    const t = await sequelize.transaction();
    try {
      const existingDaybook = await this.daybookRepository.getDayBookById(
        daybookId,
      );
      if (!existingDaybook) {
        const error = new Error("DayBook not found");
        error.statusCode = 404;
        throw error;
      }
      assertActorCanAccessLocation(
        actor || {},
        existingDaybook.location_scope,
        "cancel MRN for this daybook",
      );

      const daybook = await this.daybookRepository.getDayBookForMrnCancellation(
        daybookId,
        t,
      );

      if (!daybook) {
        throw new Error("DayBook not found");
      }

      if (!daybook.mrn_security_code) {
        throw new Error("MRN is not generated for this DayBook");
      }

      if (daybook.status === "Cancelled") {
        throw new Error("MRN already cancelled");
      }

      const serializedItems = [];
      const nonSerializedItems = [];

      for (const item of daybook.DayBookItems) {
        if (item.DayBookItemSerials?.length > 0) {
          serializedItems.push(item);
        } else {
          nonSerializedItems.push(item);
        }
      }

      /* -------------------------------------------------
       1️⃣ VALIDATE SERIALIZED ITEMS MUST BE IN STORE
    -------------------------------------------------- */
      const assetEventService = new AssetEventService();
      for (const item of serializedItems) {
        for (const serial of item.DayBookItemSerials) {
          const asset = await Asset.findOne({
            where: {
              serial_number: serial.serial_number,
              status: "InStore",
              is_active: true,
            },
            transaction: t,
          });

          if (!asset) {
            throw new Error(
              `Serialized asset ${serial.serial_number} is not in store`,
            );
          }
          await assetEventService.create(
            {
              asset_id: asset.id,
              event_type: "MRN Cancelled",
              event_date: new Date(),
              daybook_id: daybook.id,
              notes: "MRN cancelled and stock reverted",
            },
            { transaction: t },
          );
        }
      }

      /* -------------------------------------------------
       2️⃣ NON-SERIALIZED CONFIRMATION
    -------------------------------------------------- */
      if (nonSerializedItems.length > 0 && confirmedNonSerialized !== true) {
        await t.rollback();
        return {
          requiresConfirmation: true,
          nonSerializedItems: nonSerializedItems.map((i) => ({
            id: i.id,
            item_name: i.item_name,
            quantity: i.quantity,
            sku_unit: i.sku_unit || "Unit",
          })),
        };
      }

      /* -------------------------------------------------
        3️⃣ SOFT DELETE STOCK + ASSETS
      -------------------------------------------------- */
      const now = new Date();

      for (const item of daybook.DayBookItems) {
        if (!item.Stock) continue;

        // Soft-delete assets linked to this daybook item
        await Asset.update(
          {
            status: "Removed as MRN Cancelled",
            stock_id: null,
            is_active: false,
            deleted_at: now,
          },
          {
            where: { daybook_item_id: item.id },
            transaction: t,
          },
        );

        // Detach item from stock
        await item.update({ stock_id: null }, { transaction: t });

        // Soft-delete stock row
        await item.Stock.update(
          {
            quantity: 0,
            is_active: false,
            deleted_at: now,
          },
          { transaction: t },
        );
      }

      /* -------------------------------------------------
       4️⃣ ASSET EVENT LOG
    -------------------------------------------------- */
      // const assetEventService = new AssetEventService();
      // await assetEventService.create(
      //   {
      //     event_type: "MRN Cancelled",
      //     event_date: new Date(),
      //     daybook_id: daybook.id,
      //     notes: "MRN cancelled and stock reverted",
      //   },
      //   { transaction: t },
      // );

      /* -------------------------------------------------
       5️⃣ MARK DAYBOOK CANCELLED
    -------------------------------------------------- */
      await daybook.update(
        {
          status: "MRN Cancelled",
          mrn_cancelled_at: new Date(),
        },
        { transaction: t },
      );

      await t.commit();
      return { cancelled: true };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getDayBookFullDetails(id, actor = null) {
    try {
      const dayBook = await this.daybookRepository.getDayBookFullDetails(id);
      if (dayBook) {
        assertActorCanAccessLocation(
          actor || {},
          dayBook.location_scope,
          "access MRN details for this location",
        );
      }
      return dayBook;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async updateFullDayBook(daybookId, payload) {
    return sequelize.transaction(async (t) => {
      // 1. Update DayBook header
      await this.daybookRepository.updateDayBook(daybookId, payload.header, t);

      // 2. Replace Items
      await this.daybookRepository.replaceDayBookItems(
        daybookId,
        payload.items,
        t,
      );

      // 3. Replace Additional Charges
      await this.daybookRepository.replaceAdditionalCharges(
        daybookId,
        payload.charges,
        t,
      );

      // 4. Replace Serials
      await this.daybookRepository.replaceSerials(
        daybookId,
        payload.serials,
        t,
      );
    });
  }

  async getMrnWithFilters(filters) {
    try {
      const {
        search,
        finYear,
        status,
        entryType,
        page,
        limit,
        cursor,
        cursorMode,
        viewerUserId = null,
        viewerRoles = [],
        viewerAssignments = [],
        viewerLocationScopes = [],
      } = filters;

      const normalizedRoles = this.normalizeRoles(viewerRoles);
      const hasPrivilegedRole = this.isPrivilegedViewer(normalizedRoles);
      const numericViewerUserId = Number(viewerUserId);
      const applyOwnershipScope =
        Number.isFinite(numericViewerUserId) &&
        normalizedRoles.length > 0 &&
        !hasPrivilegedRole;

      const roleStageOrders = applyOwnershipScope
        ? await this.getRoleStageOrders(normalizedRoles)
        : [];

      const safeFilters = {
        search: search || "",
        finYear: finYear || null,
        status: status || null,
        entryType: entryType || null,
        page: page || null,
        limit: limit || null,
        cursor: cursor || null,
        cursorMode: Boolean(cursorMode),
        applyOwnershipScope,
        viewerUserId: Number.isFinite(numericViewerUserId)
          ? numericViewerUserId
          : null,
        viewerRoleStageOrders: roleStageOrders,
        viewerActor: {
          id: Number.isFinite(numericViewerUserId) ? numericViewerUserId : null,
          roles: normalizedRoles,
          assignments: viewerAssignments,
          location_scopes: viewerLocationScopes,
        },
      };

      return await this.daybookRepository.getMrnWithFilters(safeFilters);
    } catch (error) {
      console.log("Something went wrong at service layer (getMrnWithFilters).");
      throw error;
    }
  }
}

module.exports = DayBookService;
