const {
  CategoryGroupRepository,
} = require("../repository/index");

class CategoryGroupService {
  constructor() {
    this.repository = new CategoryGroupRepository();
  }

  async createCategoryGroup(data) {
    if (!data.category_group_name) {
      throw new Error("category_group_name is required");
    }
    if (!data.category_head_id) {
      throw new Error("category_head_id is required");
    }

    return this.repository.create(data);
  }

  async getAllCategoryGroups() {
    return this.repository.getAll();
  }

  async getCategoryGroupById(id) {
    return this.repository.getById(id);
  }

  async getGroupsByHead(headId) {
    return this.repository.getByHeadId(headId);
  }

  async updateCategoryGroup(id, data) {
    return this.repository.update(id, data);
  }

  async deleteCategoryGroup(id) {
    return this.repository.delete(id);
  }
}

module.exports = CategoryGroupService;
