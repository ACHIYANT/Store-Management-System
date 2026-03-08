// import { VendorRepository } from "../repository/index";
const { ItemCategoryRepository } = require("../repository/index");

class ItemCategoryService {
  constructor() {
    this.itemCategoryRepository = new ItemCategoryRepository();
  }

  async createItemCategory(data) {
    try {
      const itemCategory = await this.itemCategoryRepository.createItemCategory(
        data
      );
      return itemCategory;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }



  async updateItemCategory(itemCategoryId, data) {
    try {
      const itemCategory = await this.itemCategoryRepository.updateItemCategory(
        itemCategoryId,
        data
      );

      return itemCategory;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }


  async getItemCategoryById(id) {
    try {
      const itemCategory =
        await this.itemCategoryRepository.getItemCategoryById(id);
      return itemCategory;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async getAllItemCategory(query = {}) {
    try {
      const itemCategories =
        await this.itemCategoryRepository.getAllItemsCategory(query);
      return itemCategories;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }

  async filterItemCategories(filters) {
    try {
      const itemCategories =
        await this.itemCategoryRepository.filter(filters);
      return itemCategories;
    } catch (error) {
      console.log("Something went wrong at service layer.");
      throw { error };
    }
  }


}

module.exports = ItemCategoryService;
