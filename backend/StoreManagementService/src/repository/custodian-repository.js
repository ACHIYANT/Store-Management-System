const { Custodian } = require("../models");
const { Op } = require("sequelize");
const { normalizeLimit } = require("../utils/cursor-pagination");

const normalizeType = (value) =>
  value == null ? null : String(value).trim().toUpperCase();

class CustodianRepository {
  async createCustodian(payload) {
    const id = payload?.id != null ? String(payload.id).trim() : "";
    const displayName =
      payload?.display_name != null
        ? String(payload.display_name).trim()
        : payload?.displayName != null
          ? String(payload.displayName).trim()
          : "";
    const type = normalizeType(payload?.custodian_type ?? payload?.custodianType);

    if (!id) throw new Error("custodian id is required");
    if (!displayName) throw new Error("display_name is required");
    if (!type) throw new Error("custodian_type is required");

    return Custodian.create({
      id,
      custodian_type: type,
      display_name: displayName,
      employee_id: null,
      is_active: true,
    });
  }

  async getById(id) {
    return Custodian.findByPk(String(id));
  }

  async list({
    search = "",
    custodian_type = "",
    page = null,
    limit = null,
  } = {}) {
    const where = {};
    const type = normalizeType(custodian_type);
    if (type) where.custodian_type = type;

    const searchTerm = String(search || "").trim();
    if (searchTerm) {
      const like = `%${searchTerm}%`;
      where[Op.or] = [
        { id: { [Op.like]: like } },
        { display_name: { [Op.like]: like } },
      ];
    }

    const safeLimit =
      limit != null && String(limit).trim() !== ""
        ? normalizeLimit(limit, 50, 500)
        : null;
    const safePage =
      page != null && Number.isFinite(Number(page)) && Number(page) > 0
        ? Number(page)
        : null;

    const order = [
      ["display_name", "ASC"],
      ["id", "ASC"],
    ];

    if (!safeLimit || !safePage) {
      return Custodian.findAll({ where, order });
    }

    const offset = (safePage - 1) * safeLimit;
    return Custodian.findAndCountAll({ where, order, limit: safeLimit, offset });
  }
}

module.exports = CustodianRepository;
