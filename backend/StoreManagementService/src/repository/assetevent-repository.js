// repository/assetevent-repository.js
const { Op } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyDateIdDescCursor,
} = require("../utils/cursor-pagination");
const {
  AssetEvent,
  Employee,
  Asset,
  Stock,
  Custodian,
  IssuedItem,
  Requisition,
} = require("../models");
const {
  assertActorCanAccessLocation,
  buildLocationScopeWhere,
} = require("../utils/location-scope");

class AssetEventRepository {
  eventIncludes() {
    return [
      {
        model: Asset,
        attributes: [
          "id",
          "serial_number",
          "asset_tag",
          "stock_id",
          "status",
          "location_scope",
        ],
        required: false,
        include: [
          {
            model: Stock,
            attributes: ["id", "item_name"],
            required: false,
          },
        ],
      },
      {
        model: Employee,
        as: "fromEmployee",
        attributes: ["emp_id", "name", "division", "office_location"],
        required: false,
      },
      {
        model: Employee,
        as: "toEmployee",
        attributes: ["emp_id", "name", "division", "office_location"],
        required: false,
      },
      {
        model: Custodian,
        as: "custodian",
        attributes: ["id", "custodian_type", "display_name", "location"],
        required: false,
      },
      {
        model: Custodian,
        as: "fromCustodian",
        attributes: ["id", "custodian_type", "display_name", "location"],
        required: false,
      },
      {
        model: Custodian,
        as: "toCustodian",
        attributes: ["id", "custodian_type", "display_name", "location"],
        required: false,
      },
      {
        model: IssuedItem,
        attributes: ["id", "source", "requisition_url", "requisition_id"],
        required: false,
        include: [
          {
            model: Requisition,
            attributes: ["id", "req_no"],
            required: false,
          },
        ],
      },
    ];
  }

  mapEvent(row) {
    const r = row?.get ? row.get({ plain: true }) : row;
    const from = r?.fromEmployee;
    const to = r?.toEmployee;
    const asset = r?.Asset;
    const custodian = r?.custodian || null;
    const fromCustodian = r?.fromCustodian || null;
    const toCustodian = r?.toCustodian || null;
    const issuedItem = r?.IssuedItem || r?.issuedItem || null;
    const requisition = issuedItem?.Requisition || issuedItem?.requisition || null;
    const custodianId = r?.custodian_id ?? null;
    const custodianType = r?.custodian_type ?? null;
    const custodianName = custodian?.display_name ?? null;

    return {
      id: r.id,
      asset_id: r.asset_id,
      event_type: r.event_type,
      event_date: r.event_date,
      notes: r.notes,
      location_scope: r.location_scope || null,
      approval_document_url: r.approval_document_url ?? null,
      performed_by: r.performed_by,
      daybook_id: r.daybook_id ?? null,
      daybook_item_id: r.daybook_item_id ?? null,
      issued_item_id: r.issued_item_id ?? null,
      issued_item_source: issuedItem?.source ?? null,
      requisition_url: issuedItem?.requisition_url ?? null,
      requisition_id: issuedItem?.requisition_id ?? null,
      requisition_req_no: requisition?.req_no ?? null,
      custodian_id: custodianId,
      custodian_type: custodianType,
      custodian:
        custodianId || custodianName || custodianType
          ? {
              id: custodianId,
              type: custodianType,
              name: custodianName,
              location: custodian?.location ?? null,
            }
          : null,
      from_custodian_id: r?.from_custodian_id ?? null,
      from_custodian_type: r?.from_custodian_type ?? null,
      from_custodian:
        r?.from_custodian_id ||
        r?.from_custodian_type ||
        fromCustodian?.display_name
          ? {
              id: r?.from_custodian_id ?? fromCustodian?.id ?? null,
              type:
                r?.from_custodian_type ??
                fromCustodian?.custodian_type ??
                null,
              name: fromCustodian?.display_name ?? null,
              location: fromCustodian?.location ?? null,
            }
          : null,
      to_custodian_id: r?.to_custodian_id ?? null,
      to_custodian_type: r?.to_custodian_type ?? null,
      to_custodian:
        r?.to_custodian_id ||
        r?.to_custodian_type ||
        toCustodian?.display_name
          ? {
              id: r?.to_custodian_id ?? toCustodian?.id ?? null,
              type: r?.to_custodian_type ?? toCustodian?.custodian_type ?? null,
              name: toCustodian?.display_name ?? null,
              location: toCustodian?.location ?? null,
            }
          : null,
      from_employee_id: r.from_employee_id ?? null,
      to_employee_id: r.to_employee_id ?? null,
      from_employee: from
        ? {
            emp_id: from.emp_id,
            name: from.name,
            division: from.division,
            office_location: from.office_location ?? null,
          }
        : null,
      to_employee: to
        ? {
            emp_id: to.emp_id,
            name: to.name,
            division: to.division,
            office_location: to.office_location ?? null,
          }
        : null,
      asset: asset
        ? {
            id: asset.id,
            serial_number: asset.serial_number ?? null,
            asset_tag: asset.asset_tag ?? null,
            item_name: asset.Stock?.item_name ?? null,
            status: asset.status ?? null,
            location_scope: asset.location_scope ?? null,
          }
        : null,
    };
  }

  async create(eventData, options = {}) {
    try {
      const row = await AssetEvent.create(eventData, options);
      return row;
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer (AssetEvent.create)."
      );
      throw { error };
    }
  }

  async bulkCreate(events = []) {
    try {
      return await AssetEvent.bulkCreate(events);
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer (AssetEvent.bulkCreate)."
      );
      throw { error };
    }
  }

  async getByAssetId(assetId, viewerActor = null) {
    try {
      const where = { asset_id: assetId };
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }
      const rows = await AssetEvent.findAll({
        where,
        order: [
          ["event_date", "ASC"],
          ["id", "ASC"],
        ],
        include: this.eventIncludes(),
      });
      return rows.map((row) => this.mapEvent(row));
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer (getByAssetId)."
      );
      throw { error };
    }
  }

  async getTimeline(assetId, viewerActor = null) {
    // alias of getByAssetId with explicit name
    return this.getByAssetId(assetId, viewerActor);
  }

  async getByDayBookId(daybookId, viewerActor = null) {
    try {
      const where = { daybook_id: daybookId };
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }
      const rows = await AssetEvent.findAll({
        where,
        order: [
          ["event_date", "ASC"],
          ["id", "ASC"],
        ],
        include: this.eventIncludes(),
      });
      return rows.map((row) => this.mapEvent(row));
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer (getByDayBookId)."
      );
      throw { error };
    }
  }

  async getByIssuedItemId(issuedItemId, viewerActor = null) {
    try {
      const where = { issued_item_id: issuedItemId };
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }
      const rows = await AssetEvent.findAll({
        where,
        order: [
          ["event_date", "ASC"],
          ["id", "ASC"],
        ],
        include: this.eventIncludes(),
      });
      return rows.map((row) => this.mapEvent(row));
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer (getByIssuedItemId)."
      );
      throw { error };
    }
  }

  async getByEmployeeHistory(employeeId, viewerActor = null) {
    try {
      const where = {
        [Op.or]: [{ to_employee_id: employeeId }, { from_employee_id: employeeId }],
      };
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }
      const rows = await AssetEvent.findAll({
        where,
        order: [
          ["event_date", "ASC"],
          ["id", "ASC"],
        ],
        include: this.eventIncludes(),
      });
      return rows.map((row) => this.mapEvent(row));
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer (getByEmployeeHistory)."
      );
      throw { error };
    }
  }

  async recent(limit = 50, viewerActor = null) {
    try {
      const safeLimit = Math.max(1, Number(limit) || 50);
      const where = {};
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }
      const rows = await AssetEvent.findAll({
        where,
        limit: safeLimit,
        order: [
          ["event_date", "DESC"],
          ["id", "DESC"],
        ],
        include: this.eventIncludes(),
      });
      return rows.map((row) => this.mapEvent(row));
    } catch (error) {
      console.log("Something went wrong in the repository layer (recent).");
      throw { error };
    }
  }

  async search({
    page = 1,
    limit = 50,
    cursor = null,
    cursorMode = false,
    search,
    eventType,
    assetId,
    fromEmployeeId,
    toEmployeeId,
    daybookId,
    issuedItemId,
    fromDate,
    toDate,
    viewerActor = null,
  }) {
    try {
      const safePage = Math.max(1, Number(page) || 1);
      const safeLimit = normalizeLimit(limit, 50, 500);
      const useCursorMode = Boolean(cursorMode);
      const offset = (safePage - 1) * safeLimit;
      const searchTerm = typeof search === "string" ? search.trim() : "";
      const toNumber = (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      };

      const where = {};
      const locationWhere = buildLocationScopeWhere(viewerActor || {});
      if (locationWhere) {
        Object.assign(where, locationWhere);
      }

      if (eventType) where.event_type = eventType;
      const parsedAssetId = toNumber(assetId);
      const parsedFromEmployeeId = toNumber(fromEmployeeId);
      const parsedToEmployeeId = toNumber(toEmployeeId);
      const parsedDaybookId = toNumber(daybookId);
      const parsedIssuedItemId = toNumber(issuedItemId);

      if (parsedAssetId !== undefined) where.asset_id = parsedAssetId;
      if (parsedFromEmployeeId !== undefined) {
        where.from_employee_id = parsedFromEmployeeId;
      }
      if (parsedToEmployeeId !== undefined) where.to_employee_id = parsedToEmployeeId;
      if (parsedDaybookId !== undefined) where.daybook_id = parsedDaybookId;
      if (parsedIssuedItemId !== undefined) where.issued_item_id = parsedIssuedItemId;

      if (fromDate || toDate) {
        where.event_date = {};
        if (fromDate) where.event_date[Op.gte] = new Date(`${fromDate}T00:00:00.000`);
        if (toDate) where.event_date[Op.lte] = new Date(`${toDate}T23:59:59.999`);
      }

      if (searchTerm) {
        const like = `%${searchTerm}%`;
        const searchOr = [
          { event_type: { [Op.like]: like } },
          { notes: { [Op.like]: like } },
          { "$Asset.serial_number$": { [Op.like]: like } },
          { "$Asset.asset_tag$": { [Op.like]: like } },
          { "$Asset.Stock.item_name$": { [Op.like]: like } },
          { "$fromEmployee.name$": { [Op.like]: like } },
          { "$fromEmployee.division$": { [Op.like]: like } },
          { "$toEmployee.name$": { [Op.like]: like } },
          { "$toEmployee.division$": { [Op.like]: like } },
          { "$fromCustodian.id$": { [Op.like]: like } },
          { "$fromCustodian.display_name$": { [Op.like]: like } },
          { "$toCustodian.id$": { [Op.like]: like } },
          { "$toCustodian.display_name$": { [Op.like]: like } },
        ];

        const numericSearch = Number(searchTerm);
        if (Number.isFinite(numericSearch)) {
          searchOr.unshift(
            { id: numericSearch },
            { asset_id: numericSearch },
            { from_employee_id: numericSearch },
            { to_employee_id: numericSearch },
            { daybook_id: numericSearch },
            { daybook_item_id: numericSearch },
            { issued_item_id: numericSearch },
          );
        }

        where[Op.or] = searchOr;
      }

      const baseQuery = {
        include: this.eventIncludes(),
        distinct: true,
        subQuery: false,
        order: [
          ["event_date", "DESC"],
          ["id", "DESC"],
        ],
      };

      if (useCursorMode) {
        const cursorParts = decodeCursor(cursor);
        const cursorWhere = applyDateIdDescCursor(where, cursorParts, "event_date", "id");
        const rowsWithExtra = await AssetEvent.findAll({
          ...baseQuery,
          where: cursorWhere,
          limit: safeLimit + 1,
        });

        const hasMore = rowsWithExtra.length > safeLimit;
        const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
        const nextCursor =
          hasMore && rows.length
            ? encodeCursor({
                event_date:
                  rows[rows.length - 1].event_date instanceof Date
                    ? rows[rows.length - 1].event_date.toISOString()
                    : new Date(rows[rows.length - 1].event_date).toISOString(),
                id: rows[rows.length - 1].id,
              })
            : null;

        return {
          rows: rows.map((row) => this.mapEvent(row)),
          meta: {
            limit: safeLimit,
            hasMore,
            nextCursor,
            mode: "cursor",
          },
        };
      }

      const { rows, count } = await AssetEvent.findAndCountAll({
        ...baseQuery,
        where,
        limit: safeLimit,
        offset,
      });

      return {
        rows: rows.map((row) => this.mapEvent(row)),
        total: count,
        page: safePage,
        limit: safeLimit,
      };
    } catch (error) {
      console.log("Something went wrong in the repository layer (search).");
      throw { error };
    }
  }
}

module.exports = AssetEventRepository;
