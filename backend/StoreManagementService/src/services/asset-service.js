const AssetRepository = require("../repository/asset-repository");
const {
  normalizeLimit,
  parseCursorMode,
} = require("../utils/cursor-pagination");

class AssetService {
  constructor() {
    this.assetRepository = new AssetRepository();
  }
  async finalizeApprovedDaybook(daybookId, transaction = null) {
    try {
      const repo = new AssetRepository();
      const assetData = await repo.migrateSerialsToAssets(
        daybookId,
        transaction,
      );
      console.log("Asset", assetData);
      return assetData;
    } catch (error) {
      console.log(
        "Something went wrong at service layer (finalizeApprovedDaybook).",
      );
      throw error;
    }
  }

  async getAll() {
    return await new AssetRepository().getAll();
  }

  async getInStoreByStock(stockId, query = {}) {
    try {
      const repo = new AssetRepository();
      const useCursorMode = parseCursorMode(query.cursorMode);
      const safeLimit =
        query.limit != null && String(query.limit).trim() !== ""
          ? normalizeLimit(query.limit, 100, 500)
          : null;
      return await repo.getInStoreByStock(stockId, {
        search: query.search,
        limit: safeLimit,
        cursor: query.cursor,
        cursorMode: useCursorMode,
      });
    } catch (error) {
      console.log("Something went wrong at service layer (getInStoreByStock).");
      throw { error };
    }
  }

  async getByEmployee(employeeId) {
    try {
      const repo = new AssetRepository();
      return await repo.getByEmployee(employeeId);
    } catch (error) {
      console.log("Something went wrong at service layer (getByEmployee).");
      throw { error };
    }
  }

  async returnAssets(payload) {
    try {
      const repo = new AssetRepository();
      return await repo.returnAssets(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (returnAssets).");
      throw { error };
    }
  }

  async transferAssets(payload) {
    try {
      const repo = new AssetRepository();
      return await repo.transferAssets(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (transferAssets).");
      throw { error };
    }
  }

  async repairOut(payload) {
    try {
      const repo = new AssetRepository();
      return await repo.repairOut(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (repairOut).");
      throw error;
    }
  }

  async repairIn(payload) {
    try {
      const repo = new AssetRepository();
      return await repo.repairIn(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (repairIn).");
      throw error;
    }
  }

  async finalize(payload) {
    try {
      const repo = new AssetRepository();
      return await repo.finalize(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (finalize).");
      throw error;
    }
  }

  async retain(payload) {
    try {
      const repo = new AssetRepository();
      return await repo.retain(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (retain).");
      throw error;
    }
  }

  /* =====================================
     ✅ Asset Categories Summary
  ===================================== */
  async getAssetsGroupedByCategory(query = {}) {
    const useCursorMode = parseCursorMode(query.cursorMode);
    const safeLimit =
      query.limit != null && String(query.limit).trim() !== ""
        ? normalizeLimit(query.limit, 100, 500)
        : null;
    const result = await this.assetRepository.getAssetsGroupedByCategory({
      search: query.search,
      limit: safeLimit,
      cursor: query.cursor ? String(query.cursor) : null,
      cursorMode: useCursorMode,
    });
    const rows = Array.isArray(result) ? result : result?.rows || [];
    const meta = Array.isArray(result) ? null : result?.meta || null;

    // Format clean response
    const mapped = rows.map((r) => ({
      item_category_id: r.item_category_id,
      category_name: r.category_name,
      total_assets: Number(r.total_assets),
    }));
    return meta ? { rows: mapped, meta } : mapped;
  }

  /* =====================================
     ✅ Assets By Category
  ===================================== */
  async getAssetsByCategory(categoryId, query = {}) {
    const useCursorMode = parseCursorMode(query.cursorMode);
    const safeLimit =
      query.limit != null && String(query.limit).trim() !== ""
        ? normalizeLimit(query.limit, 100, 500)
        : null;
    return await this.assetRepository.getAssetsByCategory(categoryId, {
      limit: safeLimit,
      cursor: query.cursor ? String(query.cursor) : null,
      cursorMode: useCursorMode,
    });
  }

  async getAssets(query) {
    const page = Number(query.page || 1);
    const limit = normalizeLimit(query.limit || 50, 50, 500);
    const cursor = query.cursor ? String(query.cursor) : null;
    const cursorMode = parseCursorMode(query.cursorMode);

    const filters = {
      status: query.status,
      category_id: query.category_id,
      category_head_id: query.categoryHeadId,
      category_group_id: query.categoryGroupId,
      employee_id: query.employee_id,
      stock_id: query.stock_id,
      search: query.search,
      from_date: query.from_date,
      to_date: query.to_date,
    };

    const result = await this.assetRepository.findAll({
      filters,
      page,
      limit,
      cursor,
      cursorMode,
    });

    if (result?.meta) {
      return {
        rows: result.rows || [],
        meta: result.meta,
      };
    }

    const { rows, count } = result;

    return {
      rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
        hasMore: page < Math.ceil(count / limit),
        mode: "offset",
      },
    };
  }
}

module.exports = AssetService;
