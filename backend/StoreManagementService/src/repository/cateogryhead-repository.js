const { ItemCategoryHead } = require("../models/index");

class CategoryHeadRepository {
  async create(data) {
    try {
      return await ItemCategoryHead.create(data);
    } catch (error) {
      console.error("CategoryHeadRepository.create error");
      throw error;
    }
  }

  async getAll() {
    try {
      return await ItemCategoryHead.findAll({
        order: [["category_head_name", "ASC"]],
      });
    } catch (error) {
      throw error;
    }
  }

  async getById(id) {
    try {
      return await ItemCategoryHead.findByPk(id);
    } catch (error) {
      throw error;
    }
  }

  async update(id, data) {
    try {
      const [count] = await ItemCategoryHead.update(data, {
        where: { id },
      });

      if (count === 0) {
        throw new Error("CategoryHead not found");
      }

      return this.getById(id);
    } catch (error) {
      throw error;
    }
  }

  async delete(id) {
    try {
      const count = await ItemCategoryHead.destroy({
        where: { id },
      });

      if (count === 0) {
        throw new Error("CategoryHead not found");
      }

      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CategoryHeadRepository;
