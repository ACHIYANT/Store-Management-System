// ! Repository folder is to have the interactions with the model and database.
// import { where } from "sequelize";
// import { Vendor } from "../models/index";

const {
  ItemCategory,
  ItemCategoryGroup,
  ItemCategoryHead,
} = require("../models/index");
const { Op } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyStringIdAscCursor,
} = require("../utils/cursor-pagination");

class ItemCategoryRepository {
  async createItemCategory(data) {
    try {
      console.log(
        "Trying to create item category in the try block of repository layer.",
      );
      const itemCategory = await ItemCategory.create(data);
      return itemCategory;
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer while creating item category.",
      );
      throw { error };
    }
  }

  async deleteItemCategory(itemCategoryId) {
    try {
      await ItemCategory.destroy({
        where: {
          id: itemCategoryId,
        },
      });
      return true;
    } catch (error) {
      console.log(
        "Something went wrong in the repository layer while deleting the item category.",
      );
      throw { error };
    }
  }

  async updateItemCategory(id, data) {
    try {
      const [updatedRowsCount] = await ItemCategory.update(
        {
          category_name: data.category_name,
          group_id: data.group_id,
          serialized_required: data.serialized_required,
        },
        { where: { id } },
      );

      if (updatedRowsCount === 0) {
        throw new Error(
          "Item category not found with the given id or no changes made",
        );
      }

      const updatedItemCategory = await ItemCategory.findByPk(id);
      return updatedItemCategory;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getItemCategoryById(id) {
    try {
      return await ItemCategory.findByPk(id, {
        include: [
          {
            model: ItemCategoryGroup,
            as: "group",
            attributes: ["id", "category_group_name"],
            include: [
              {
                model: ItemCategoryHead,
                as: "head",
                attributes: ["id", "category_head_name"],
              },
            ],
          },
        ],
      });
    } catch (error) {
      throw error;
    }
  }

  async getAllItemsCategory({ page = null, limit = null } = {}) {
    try {
      const include = [
        {
          model: ItemCategoryGroup,
          as: "group",
          attributes: ["id", "category_group_name"],
          include: [
            {
              model: ItemCategoryHead,
              as: "head",
              attributes: ["id", "category_head_name"],
            },
          ],
        },
      ];
      const order = [
        ["category_name", "ASC"],
        ["id", "ASC"],
      ];

      const safePage =
        Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : null;
      const safeLimit =
        Number.isFinite(Number(limit)) && Number(limit) > 0
          ? normalizeLimit(limit, 100, 500)
          : null;

      if (safePage && safeLimit) {
        const offset = (safePage - 1) * safeLimit;
        const { rows, count } = await ItemCategory.findAndCountAll({
          include,
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

      return await ItemCategory.findAll({ include, order });
    } catch (error) {
      throw error;
    }
  }

  async filter(filters) {
    try {
      const where = {};
      const {
        category_name,
        serialized_required,
        group_id,
        head_id,
        page = null,
        limit = null,
        cursor = null,
        cursorMode = false,
      } = filters || {};

      if (category_name) {
        where.category_name = {
          [Op.like]: `%${category_name}%`,
        };
      }

      if (serialized_required !== undefined && serialized_required !== "") {
        where.serialized_required = serialized_required === "true";
      }

      if (group_id) {
        where.group_id = group_id;
      }

      const include = [
        {
          model: ItemCategoryGroup,
          as: "group",
          required: !!(group_id || head_id),
          where: group_id ? { id: group_id } : undefined,
          include: [
            {
              model: ItemCategoryHead,
              as: "head",
              required: !!head_id,
              where: head_id ? { id: head_id } : undefined,
            },
          ],
        },
      ];

      const order = [
        ["category_name", "ASC"],
        ["id", "ASC"],
      ];
      const useCursorMode = Boolean(cursorMode) && limit != null;

      if (useCursorMode) {
        const safeLimit = normalizeLimit(limit, 100, 500);
        const cursorParts = decodeCursor(cursor);
        const cursorWhere = applyStringIdAscCursor(
          where,
          cursorParts,
          "category_name",
          "id",
        );

        const rowsWithExtra = await ItemCategory.findAll({
          where: cursorWhere,
          include,
          order,
          limit: safeLimit + 1,
        });
        const hasMore = rowsWithExtra.length > safeLimit;
        const rows = hasMore
          ? rowsWithExtra.slice(0, safeLimit)
          : rowsWithExtra;
        const lastRow = rows.length ? rows[rows.length - 1] : null;
        const nextCursor =
          hasMore && lastRow
            ? encodeCursor({
                category_name: lastRow.category_name || "",
                id: lastRow.id,
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
        const { rows, count } = await ItemCategory.findAndCountAll({
          where,
          include,
          order,
          limit: safeLimit,
          offset,
          distinct: true,
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

      return await ItemCategory.findAll({
        where,
        include,
        order,
      });
    } catch (error) {
      console.log(
        "Something went wrong in the filters function inside the item categories repository.",
      );
      throw error;
    }
  }
}

module.exports = ItemCategoryRepository;
