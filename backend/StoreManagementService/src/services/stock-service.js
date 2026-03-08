const { StockRepository } = require("../repository/index");

class StockService {
  constructor() {
    this.stockRepository = new StockRepository();
  }

  async moveDayBookItemsToStock(daybookId, transaction = null) {
    try {
      // Call repository method to move DayBookItems to Stock
      const createdStocks = await this.stockRepository.moveDayBookItemsToStock(
        daybookId,
        transaction,
      );
      console.log("create stock : ", createdStocks);
      return createdStocks;
    } catch (error) {
      console.error("Error in StockService:", error);
      throw new Error("Error in Service layer while moving items to stock");
    }
  }

  async getAll() {
    try {
      const repo = new StockRepository();
      return await repo.getAll();
    } catch (error) {
      console.log("Something went wrong at service layer (getAll stocks).");
      throw error;
    }
  }
  // async getAllStocksByCategory() {
  //   try {
  //     const stocksByCategory =
  //       await this.stockRepository.getAllStocksByCategory();
  //     return stocksByCategory;
  //   } catch (error) {
  //     console.log("Error in stock service: ", error);
  //     throw new Error(
  //       "Error in service layer while fetching stocks by category."
  //     );
  //   }
  // }

  async getAllStocksByCategory(filters) {
    try {
      return await this.stockRepository.getAllStocksByCategory(filters);
    } catch (error) {
      console.log("Error in stock service:", error);
      throw error;
    }
  }

  async getStocksByCategoryId(categoryId, filters = {}) {
    try {
      return await this.stockRepository.getStocksByCategoryId(
        categoryId,
        filters,
      );
    } catch (error) {
      throw error;
    }
  }
}

module.exports = StockService;
