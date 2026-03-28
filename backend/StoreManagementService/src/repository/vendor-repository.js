// ! Repository folder is to have the interactions with the model and database.
// import { where } from "sequelize";
// import { Vendor } from "../models/index";

const { Vendors } = require("../models/index");
const { Op } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyIdDescCursor,
} = require("../utils/cursor-pagination");

class VendorRepository {
  sanitizeVendorPayload(data = {}) {
    const payload = { ...data };

    if (Object.prototype.hasOwnProperty.call(payload, "gst_no")) {
      const raw = payload.gst_no;
      if (raw === null || raw === undefined || String(raw).trim() === "") {
        payload.gst_no = null;
      } else {
        payload.gst_no = String(raw).trim().toUpperCase();
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "name")) {
      payload.name = String(payload.name || "")
        .trim()
        .replace(/\s+/g, " ");
    }

    if (Object.prototype.hasOwnProperty.call(payload, "address")) {
      payload.address = String(payload.address || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(payload, "mobile_no")) {
      const raw = payload.mobile_no;
      if (raw === null || raw === undefined || String(raw).trim() === "") {
        payload.mobile_no = null;
      } else {
        payload.mobile_no = String(raw).trim();
      }
    }

    return payload;
  }

  async createVendor(data) {
    try {
      console.log(
        "Trying to create vendor in the try block of repository layer."
      );
      const payload = this.sanitizeVendorPayload(data);
      const vendor = await Vendors.create(payload);
      return vendor;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async deleteVendor(vendorId) {
    try {
      await Vendors.destroy({
        where: {
          id: vendorId,
        },
      });
      return true;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async updateVendor(vendorId, data) {
    try {
      const payload = this.sanitizeVendorPayload(data);

      const [updatedRowsCount] = await Vendors.update(payload, {
        where: {
          id: vendorId,
        },
      });

      if (updatedRowsCount === 0) {
        // No vendor found with the given id
        throw new Error("Vendor not found or no changes made");
      }

      const updatedVendor = await Vendors.findByPk(vendorId);
      return updatedVendor;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getVendor(gstNumber) {
    try {
      const normalizedGst =
        gstNumber === null || gstNumber === undefined
          ? ""
          : String(gstNumber).trim().toUpperCase();
      if (!normalizedGst) return null;

      //   const vendor = await Vendor.findByPk(vendorId);
      const vendor = await Vendors.findOne({
        where: {
          gst_no: normalizedGst, // 'gst' should match the column name in your model
        },
      });
      return vendor;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getVendorById(id) {
    try {
      //   const vendor = await Vendor.findByPk(vendorId);
      const vendor = await Vendors.findOne({
        where: {
          id: id, // 'gst' should match the column name in your model
        },
      });
      return vendor;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getAllVendors({
    search = "",
    page = null,
    limit = null,
    cursor = null,
    cursorMode = false,
  } = {}) {
    try {
      const where = {};
      const searchTerm = String(search || "").trim();
      if (searchTerm) {
        const like = `%${searchTerm}%`;
        where[Op.or] = [
          { name: { [Op.like]: like } },
          { address: { [Op.like]: like } },
          { gst_no: { [Op.like]: like } },
          { mobile_no: { [Op.like]: like } },
        ];
      }

      const order = [["id", "DESC"]];
      const useCursorMode = Boolean(cursorMode) && limit != null;

      if (useCursorMode) {
        const safeLimit = normalizeLimit(limit, 100, 500);
        const cursorParts = decodeCursor(cursor);
        const cursorWhere = applyIdDescCursor(where, cursorParts, "id");

        const rowsWithExtra = await Vendors.findAll({
          where: cursorWhere,
          order,
          limit: safeLimit + 1,
        });

        const hasMore = rowsWithExtra.length > safeLimit;
        const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
        const nextCursor =
          hasMore && rows.length
            ? encodeCursor({ id: rows[rows.length - 1].id })
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
        const { rows, count } = await Vendors.findAndCountAll({
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

      return await Vendors.findAll({ where, order });
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async searchVendorByName(name, options = {}) {
    try {
      return await this.getAllVendors({
        ...options,
        search: name || "",
      });
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }
}

module.exports = VendorRepository;
