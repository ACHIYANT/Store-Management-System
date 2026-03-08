const { DayBookItem } = require("../models/index");
const { Op } = require("sequelize");

class DayBookItemRepository {
  async create(itemData) {
    try {
      const dayBookItem = await DayBookItem.create(itemData);
      return dayBookItem;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async bulkCreate(items, options = {}) {
    try {
      return await DayBookItem.bulkCreate(items, options);
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }
  async findByDayBookId(daybookId) {
    try {
      return await DayBookItem.findAll({ where: { daybook_id: daybookId } });
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async updateDayBook(daybookId, data) {
    try {
      const [updatedRowsCount] = await DayBookItem.update(data, {
        where: {
          id: daybookId,
        },
      });

      if (updatedRowsCount === 0) {
        // No daybook record found with the given id
        throw new Error("Daybook not found or no changes made");
      }
      const updatedDaybook = await DayBookItem.findByPk(daybookId);
      return updatedDaybook;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }
  async deleteByDayBookId(daybookId) {
    try {
      return await DayBookItem.destroy({ where: { daybook_id: daybookId } });
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async findItemIdsByDaybook(daybookId, transaction) {
    const rows = await DayBookItem.findAll({
      where: { daybook_id: daybookId },
      attributes: ["id"],
      transaction,
      raw: true,
    });

    return rows.map((r) => r.id);
  }

  async deleteItemsByDaybook(daybookId, transaction) {
    return DayBookItem.destroy({
      where: { daybook_id: daybookId },
      transaction,
    });
  }

  async deleteByIds(ids, transaction) {
    return DayBookItem.destroy({
      where: { id: { [Op.in]: ids } },
      transaction,
    });
  }

  async bulkCreateItems(daybookId, items, transaction) {
    const payload = items.map((i) => ({
      ...i,
      daybook_id: daybookId,
    }));

    return DayBookItem.bulkCreate(payload, { transaction });
  }
}

module.exports = DayBookItemRepository;
