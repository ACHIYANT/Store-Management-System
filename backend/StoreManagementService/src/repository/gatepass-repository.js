const {
  sequelize,
  GatePass,
  GatePassItem,
  Asset,
  AssetEvent,
  Employee,
  Vendors,
} = require("../models");
const { Op } = require("sequelize");
const { generateGatePassSecurityCode } = require("../utils/gatePassSecurityCode");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyDateIdDescCursor,
} = require("../utils/cursor-pagination");

class GatePassRepository {
  _sanitizeAssetIds(assetIds = []) {
    return [...new Set((assetIds || []).map(Number).filter(Number.isFinite))];
  }

  _include() {
    return [
      {
        model: GatePassItem,
        as: "items",
        required: false,
        attributes: [
          "id",
          "asset_id",
          "asset_tag_snapshot",
          "serial_number_snapshot",
          "out_verified_at",
          "out_verified_by",
          "in_verified_at",
          "in_verified_by",
        ],
        include: [
          {
            model: Asset,
            required: false,
            attributes: [
              "id",
              "asset_tag",
              "serial_number",
              "status",
              "current_employee_id",
              "vendor_id",
            ],
            include: [
              {
                model: Employee,
                required: false,
                attributes: ["emp_id", "name", "division", "designation"],
              },
              {
                model: Vendors,
                required: false,
                attributes: ["id", "name", "address"],
              },
            ],
          },
        ],
      },
    ];
  }

  _mapGatePass(row) {
    const p = row?.get ? row.get({ plain: true }) : row;
    const items = (p.items || [])
      .map((it) => {
        const vendor = it.Asset?.Vendor || it.Asset?.Vendors || null;
        return {
          id: it.id,
          asset_id: it.asset_id,
          asset_tag: it.Asset?.asset_tag || it.asset_tag_snapshot || null,
          serial_number:
            it.Asset?.serial_number || it.serial_number_snapshot || null,
          asset_status: it.Asset?.status || null,
          current_employee_id: it.Asset?.current_employee_id || null,
          current_employee: it.Asset?.Employee
            ? {
                emp_id: it.Asset.Employee.emp_id,
                name: it.Asset.Employee.name,
                division: it.Asset.Employee.division,
                designation: it.Asset.Employee.designation,
              }
            : null,
          vendor_id: it.Asset?.vendor_id || null,
          vendor: vendor
            ? {
                id: vendor.id || null,
                name: vendor.name || null,
                address: vendor.address || null,
              }
            : null,
          out_verified_at: it.out_verified_at,
          out_verified_by: it.out_verified_by,
          in_verified_at: it.in_verified_at,
          in_verified_by: it.in_verified_by,
        };
      })
      .sort((a, b) => a.id - b.id);

    const outVerifiedCount = items.filter((it) => it.out_verified_at).length;
    const inVerifiedCount = items.filter((it) => it.in_verified_at).length;
    const issuedTo = [];
    const issuedToSeen = new Set();
    const vendorRepresentatives = [];
    const vendorSeen = new Set();

    for (const item of items) {
      const employee = item.current_employee;
      if (employee) {
        const employeeKey = employee.emp_id
          ? `emp:${employee.emp_id}`
          : `emp:${employee.name || ""}:${employee.designation || ""}`;
        if (!issuedToSeen.has(employeeKey)) {
          issuedToSeen.add(employeeKey);
          issuedTo.push({
            emp_id: employee.emp_id || null,
            name: employee.name || null,
            designation: employee.designation || null,
            division: employee.division || null,
          });
        }
      }

      const vendor = item.vendor;
      if (vendor) {
        const vendorKey = vendor.id
          ? `vendor:${vendor.id}`
          : `vendor:${vendor.name || ""}:${vendor.address || ""}`;
        if (!vendorSeen.has(vendorKey)) {
          vendorSeen.add(vendorKey);
          vendorRepresentatives.push({
            id: vendor.id || null,
            name: vendor.name || null,
            address: vendor.address || null,
          });
        }
      }
    }

    const defaultIssued = issuedTo[0] || {
      emp_id: null,
      name: "Store Incharge",
      designation: "Store Incharge",
      division: null,
    };
    const defaultVendor = vendorRepresentatives[0] || {
      id: null,
      name: null,
      address: null,
    };

    const issuedSignatory = {
      emp_id:
        p.issued_signatory_emp_id != null
          ? Number(p.issued_signatory_emp_id)
          : defaultIssued.emp_id,
      name: p.issued_signatory_name || defaultIssued.name || "Store Incharge",
      designation:
        p.issued_signatory_designation ||
        defaultIssued.designation ||
        "Store Incharge",
      division: p.issued_signatory_division || defaultIssued.division || null,
    };

    const vendorSignatory = {
      name: p.vendor_signatory_name || defaultVendor.name || null,
      address: p.vendor_signatory_address || defaultVendor.address || null,
    };

    return {
      id: p.id,
      pass_no: p.pass_no,
      security_code: p.security_code,
      purpose: p.purpose,
      status: p.status,
      is_one_way: p.purpose === "EWasteOut",
      requires_gate_in: p.purpose !== "EWasteOut",
      issued_at: p.issued_at,
      out_verified_at: p.out_verified_at,
      in_verified_at: p.in_verified_at,
      notes: p.notes,
      created_by: p.created_by,
      items,
      issued_to: issuedTo,
      vendor_representatives: vendorRepresentatives,
      signatories: {
        issued_to: issuedSignatory,
        vendor_representative: vendorSignatory,
      },
      totals: {
        total_items: items.length,
        out_verified: outVerifiedCount,
        in_verified: inVerifiedCount,
      },
    };
  }

  _mapGatePassSummary(row) {
    const p = row?.get ? row.get({ plain: true }) : row;
    const items = Array.isArray(p.items) ? p.items : [];
    const outVerifiedCount = items.filter((it) => Boolean(it.out_verified_at)).length;
    const inVerifiedCount = items.filter((it) => Boolean(it.in_verified_at)).length;
    return {
      id: p.id,
      pass_no: p.pass_no,
      security_code: p.security_code,
      purpose: p.purpose,
      status: p.status,
      is_one_way: p.purpose === "EWasteOut",
      requires_gate_in: p.purpose !== "EWasteOut",
      issued_at: p.issued_at,
      out_verified_at: p.out_verified_at,
      in_verified_at: p.in_verified_at,
      notes: p.notes,
      created_by: p.created_by,
      totals: {
        total_items: items.length,
        out_verified: outVerifiedCount,
        in_verified: inVerifiedCount,
      },
    };
  }

  async list({
    page = 1,
    limit = 20,
    cursor = null,
    cursorMode = false,
    search = "",
    status = "",
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = normalizeLimit(limit, 20, 100);
    const offset = (safePage - 1) * safeLimit;
    const useCursorMode = Boolean(cursorMode);

    const where = {};
    const normalizedStatus = String(status || "").trim();
    if (normalizedStatus) where.status = normalizedStatus;

    const q = String(search || "").trim();
    if (q) {
      const like = `%${q}%`;
      where[Op.or] = [
        { pass_no: { [Op.like]: like } },
        { security_code: { [Op.like]: like } },
        { created_by: { [Op.like]: like } },
        { notes: { [Op.like]: like } },
      ];
    }

    const baseQuery = {
      where,
      attributes: [
        "id",
        "pass_no",
        "security_code",
        "purpose",
        "status",
        "issued_at",
        "out_verified_at",
        "in_verified_at",
        "notes",
        "created_by",
      ],
      include: [
        {
          model: GatePassItem,
          as: "items",
          required: false,
          attributes: ["id", "out_verified_at", "in_verified_at"],
        },
      ],
      order: [
        ["issued_at", "DESC"],
        ["id", "DESC"],
      ],
      distinct: true,
    };

    if (useCursorMode) {
      const cursorParts = decodeCursor(cursor);
      const cursorWhere = applyDateIdDescCursor(where, cursorParts, "issued_at", "id");
      const rowsWithExtra = await GatePass.findAll({
        ...baseQuery,
        where: cursorWhere,
        limit: safeLimit + 1,
      });

      const hasMore = rowsWithExtra.length > safeLimit;
      const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
      const nextCursor =
        hasMore && rows.length
          ? encodeCursor({
              issued_at:
                rows[rows.length - 1].issued_at instanceof Date
                  ? rows[rows.length - 1].issued_at.toISOString()
                  : new Date(rows[rows.length - 1].issued_at).toISOString(),
              id: rows[rows.length - 1].id,
            })
          : null;

      return {
        rows: rows.map((row) => this._mapGatePassSummary(row)),
        meta: {
          limit: safeLimit,
          hasMore,
          nextCursor,
          mode: "cursor",
        },
      };
    }

    const { rows, count } = await GatePass.findAndCountAll({
      ...baseQuery,
      limit: safeLimit,
      offset,
    });

    return {
      rows: rows.map((row) => this._mapGatePassSummary(row)),
      meta: {
        page: safePage,
        limit: safeLimit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / safeLimit)),
      },
    };
  }

  async createRepairOutPass({
    assets = [],
    notes = null,
    createdBy = null,
    transaction,
  }) {
    const safeAssets = Array.isArray(assets) ? assets : [];
    if (!safeAssets.length) {
      throw new Error("Cannot create gate pass without assets");
    }

    const issuedAt = new Date();
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempNo = `TMP-${seed}`;
    const tempCode = `TMP-${seed}`;

    const pass = await GatePass.create(
      {
        pass_no: tempNo,
        security_code: tempCode,
        purpose: "RepairOut",
        status: "Open",
        issued_at: issuedAt,
        notes: notes || null,
        created_by: createdBy || null,
      },
      { transaction },
    );

    const passNo = `GP-${new Date().getFullYear()}-${String(pass.id).padStart(
      6,
      "0",
    )}`;
    const securityCode = generateGatePassSecurityCode({
      passNo,
      gatePassId: pass.id,
    });

    await pass.update(
      {
        pass_no: passNo,
        security_code: securityCode,
      },
      { transaction },
    );

    const rows = safeAssets.map((a) => {
      const plain = a?.get ? a.get({ plain: true }) : a;
      return {
        gate_pass_id: pass.id,
        asset_id: plain.id,
        asset_tag_snapshot: plain.asset_tag || null,
        serial_number_snapshot: plain.serial_number || null,
      };
    });

    await GatePassItem.bulkCreate(rows, { transaction });

    return this.getById(pass.id, transaction);
  }

  async createEWasteOutPass({
    assetIds = [],
    notes = null,
    createdBy = null,
    vendorSignatoryName = null,
    vendorSignatoryAddress = null,
    issuedSignatoryEmpId = null,
    issuedSignatoryName = null,
    issuedSignatoryDesignation = null,
    issuedSignatoryDivision = null,
  }) {
    const normalizedAssetIds = this._sanitizeAssetIds(assetIds);
    if (!normalizedAssetIds.length) {
      throw new Error("assetIds[] is required to create E-Waste gate pass");
    }

    const normalizeText = (value) => {
      if (value == null) return null;
      const text = String(value).trim();
      return text || null;
    };

    const normalizeEmpId = (value) => {
      if (value == null || value === "") return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    };

    const t = await sequelize.transaction();
    try {
      const assets = await Asset.findAll({
        where: { id: normalizedAssetIds },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (assets.length !== normalizedAssetIds.length) {
        throw new Error("One or more selected assets were not found");
      }

      const invalid = assets.filter((asset) => String(asset.status) !== "EWaste");
      if (invalid.length) {
        const list = invalid
          .map((asset) => `#${asset.id}:${asset.status || "Unknown"}`)
          .join(", ");
        throw new Error(
          `E-Waste gate pass can be created only for EWaste assets. Invalid: ${list}`,
        );
      }

      const issuedAt = new Date();
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempNo = `TMP-${seed}`;
      const tempCode = `TMP-${seed}`;

      const pass = await GatePass.create(
        {
          pass_no: tempNo,
          security_code: tempCode,
          purpose: "EWasteOut",
          status: "Open",
          issued_at: issuedAt,
          notes: normalizeText(notes),
          created_by: normalizeText(createdBy),
          issued_signatory_emp_id: normalizeEmpId(issuedSignatoryEmpId),
          issued_signatory_name: normalizeText(issuedSignatoryName),
          issued_signatory_designation: normalizeText(issuedSignatoryDesignation),
          issued_signatory_division: normalizeText(issuedSignatoryDivision),
          vendor_signatory_name: normalizeText(vendorSignatoryName),
          vendor_signatory_address: normalizeText(vendorSignatoryAddress),
        },
        { transaction: t },
      );

      const passNo = `GP-${new Date().getFullYear()}-${String(pass.id).padStart(
        6,
        "0",
      )}`;
      const securityCode = generateGatePassSecurityCode({
        passNo,
        gatePassId: pass.id,
      });

      await pass.update(
        {
          pass_no: passNo,
          security_code: securityCode,
        },
        { transaction: t },
      );

      const rows = assets.map((asset) => ({
        gate_pass_id: pass.id,
        asset_id: asset.id,
        asset_tag_snapshot: asset.asset_tag || null,
        serial_number_snapshot: asset.serial_number || null,
      }));

      await GatePassItem.bulkCreate(rows, { transaction: t });

      const gatePass = await this.getById(pass.id, t);
      await t.commit();
      return gatePass;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async getById(id, transaction = null) {
    const row = await GatePass.findByPk(id, {
      include: this._include(),
      order: [[{ model: GatePassItem, as: "items" }, "id", "ASC"]],
      transaction,
    });
    if (!row) return null;
    return this._mapGatePass(row);
  }

  async verifyByCode(securityCode) {
    const normalizedCode = String(securityCode || "")
      .trim()
      .toUpperCase();
    if (!normalizedCode) {
      return {
        valid: false,
        reason: "Invalid gate pass verification code",
      };
    }

    const row = await GatePass.findOne({
      where: { security_code: normalizedCode },
      include: this._include(),
      order: [[{ model: GatePassItem, as: "items" }, "id", "ASC"]],
    });

    if (!row) {
      return {
        valid: false,
        reason: "Invalid gate pass verification code",
      };
    }

    const expected = generateGatePassSecurityCode({
      passNo: row.pass_no,
      gatePassId: row.id,
    });

    if (expected !== normalizedCode) {
      return {
        valid: false,
        reason: "Verification failed (data mismatch)",
      };
    }

    return {
      valid: true,
      gatePass: this._mapGatePass(row),
      verified_at: new Date(),
    };
  }

  async _verifyDirection({
    gatePassId,
    assetIds = [],
    direction = "out",
    verifiedBy = null,
  }) {
    const normalizedIds = this._sanitizeAssetIds(assetIds);
    const t = await sequelize.transaction();
    try {
      const gatePass = await GatePass.findByPk(gatePassId, {
        include: [
          {
            model: GatePassItem,
            as: "items",
            required: false,
          },
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!gatePass) throw new Error("Gate pass not found");
      const isOneWayPass = gatePass.purpose === "EWasteOut";

      const allItems = gatePass.items || [];
      const targetItems = normalizedIds.length
        ? allItems.filter((it) => normalizedIds.includes(Number(it.asset_id)))
        : allItems;

      if (!targetItems.length) {
        throw new Error("No gate pass items found for verification");
      }

      if (normalizedIds.length && targetItems.length !== normalizedIds.length) {
        throw new Error("Some selected assets are not part of this gate pass");
      }

      if (direction === "in" && isOneWayPass) {
        throw new Error("Gate-in verification is not required for E-Waste gate pass");
      }

      if (direction === "in") {
        for (const item of targetItems) {
          if (!item.out_verified_at) {
            throw new Error(
              `Asset ${item.asset_id} is not verified for gate-out yet`,
            );
          }
        }
      }

      const now = new Date();
      let affected = 0;
      for (const item of targetItems) {
        if (direction === "out" && !item.out_verified_at) {
          await item.update(
            {
              out_verified_at: now,
              out_verified_by: verifiedBy || null,
            },
            { transaction: t },
          );
          affected += 1;
        }

        if (direction === "in" && !item.in_verified_at) {
          await item.update(
            {
              in_verified_at: now,
              in_verified_by: verifiedBy || null,
            },
            { transaction: t },
          );
          affected += 1;
        }
      }

      const refreshedItems = await GatePassItem.findAll({
        where: { gate_pass_id: gatePass.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const allOut =
        refreshedItems.length > 0 &&
        refreshedItems.every((it) => Boolean(it.out_verified_at));
      const allIn =
        !isOneWayPass &&
        refreshedItems.length > 0 &&
        refreshedItems.every((it) => Boolean(it.in_verified_at));

      const patch = {};
      if (isOneWayPass) {
        if (allOut) {
          patch.status = "OutVerified";
          patch.out_verified_at = gatePass.out_verified_at || now;
          patch.in_verified_at = null;
        } else {
          patch.status = "Open";
        }
      } else if (allIn) {
        patch.status = "InVerified";
        patch.out_verified_at = gatePass.out_verified_at || now;
        patch.in_verified_at = gatePass.in_verified_at || now;
      } else if (allOut) {
        patch.status = "OutVerified";
        patch.out_verified_at = gatePass.out_verified_at || now;
        patch.in_verified_at = null;
      } else {
        patch.status = "Open";
      }

      await gatePass.update(patch, { transaction: t });

      if (isOneWayPass && direction === "out") {
        const passAssetIds = [
          ...new Set(
            refreshedItems
              .filter((item) => Boolean(item.out_verified_at))
              .map((item) => Number(item.asset_id))
              .filter(Boolean),
          ),
        ];
        if (passAssetIds.length) {
          const assets = await Asset.findAll({
            where: { id: passAssetIds },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          for (const asset of assets) {
            if (String(asset.status) === "EWasteOut") continue;
            await asset.update(
              {
                status: "EWasteOut",
                current_employee_id: null,
              },
              { transaction: t },
            );
            await AssetEvent.create(
              {
                asset_id: asset.id,
                event_type: "EWasteOut",
                event_date: now,
                notes: `E-Waste Gate Pass ${gatePass.pass_no}`,
              },
              { transaction: t },
            );
          }
        }
      }

      await t.commit();
      return {
        affected,
        gatePass: await this.getById(gatePass.id),
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  async verifyOut({ gatePassId, assetIds = [], verifiedBy = null }) {
    return this._verifyDirection({
      gatePassId,
      assetIds,
      direction: "out",
      verifiedBy,
    });
  }

  async verifyIn({ gatePassId, assetIds = [], verifiedBy = null }) {
    return this._verifyDirection({
      gatePassId,
      assetIds,
      direction: "in",
      verifiedBy,
    });
  }

  async updateSignatories({ gatePassId, payload = {} }) {
    const t = await sequelize.transaction();
    try {
      const gatePass = await GatePass.findByPk(gatePassId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!gatePass) throw new Error("Gate pass not found");

      const normalizeText = (value) => {
        if (value == null) return null;
        const text = String(value).trim();
        return text ? text : null;
      };

      const normalizeEmpId = (value) => {
        if (value == null || value === "") return null;
        const num = Number(value);
        if (!Number.isFinite(num)) return null;
        return num;
      };

      const patch = {
        issued_signatory_emp_id: normalizeEmpId(payload.issued_signatory_emp_id),
        issued_signatory_name: normalizeText(payload.issued_signatory_name),
        issued_signatory_designation: normalizeText(
          payload.issued_signatory_designation,
        ),
        issued_signatory_division: normalizeText(payload.issued_signatory_division),
        vendor_signatory_name: normalizeText(payload.vendor_signatory_name),
        vendor_signatory_address: normalizeText(payload.vendor_signatory_address),
      };

      await gatePass.update(patch, { transaction: t });
      await t.commit();
      return this.getById(gatePassId);
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

module.exports = GatePassRepository;
