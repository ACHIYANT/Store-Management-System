const { ItemCategoryGroup } = require("../models");

class CategoryGroupRepository {
  async create(data) {
    return await ItemCategoryGroup.create(data);
  }

  async getAll() {
    return await ItemCategoryGroup.findAll({
      order: [["category_group_name", "ASC"]],
    });
  }

  async getById(id) {
    return await ItemCategoryGroup.findByPk(id);
  }

  async getByHeadId(headId) {
    return await ItemCategoryGroup.findAll({
      where: { head_id: headId },
      order: [["category_group_name", "ASC"]],
    });
  }

  async update(id, data) {
    const [count] = await ItemCategoryGroup.update(data, {
      where: { id },
    });

    if (count === 0) {
      throw new Error("Category Group not found");
    }

    return this.getById(id);
  }

  async delete(id) {
    const count = await ItemCategoryGroup.destroy({
      where: { id },
    });

    if (count === 0) {
      throw new Error("Category Group not found");
    }

    return true;
  }
}

module.exports = CategoryGroupRepository;
