const {CategoryHeadRepository} = require("../repository/index");

class CategoryHeadService {
  constructor() {
    this.repository = new CategoryHeadRepository();
  }

  async createCategoryHead(data) {
    if (!data.category_head_name) {
      throw new Error("category_head_name is required");
    }

    return this.repository.create(data);
  }

  async getAllCategoryHeads() {
    return this.repository.getAll();
  }

  async getCategoryHeadById(id) {
    return this.repository.getById(id);
  }

  async updateCategoryHead(id, data) {
    return this.repository.update(id, data);
  }

  async deleteCategoryHead(id) {
    return this.repository.delete(id);
  }
}

module.exports = CategoryHeadService;
