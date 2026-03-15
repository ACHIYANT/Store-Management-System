const CustodianRepository = require("../repository/custodian-repository");

class CustodianService {
  async create(payload) {
    try {
      const repo = new CustodianRepository();
      return await repo.createCustodian(payload);
    } catch (error) {
      console.log("Something went wrong at service layer (Custodian.create).");
      throw { error };
    }
  }

  async getById(id) {
    try {
      const repo = new CustodianRepository();
      return await repo.getById(id);
    } catch (error) {
      console.log("Something went wrong at service layer (Custodian.getById).");
      throw { error };
    }
  }

  async list(params = {}) {
    try {
      const repo = new CustodianRepository();
      return await repo.list(params);
    } catch (error) {
      console.log("Something went wrong at service layer (Custodian.list).");
      throw { error };
    }
  }
}

module.exports = CustodianService;
