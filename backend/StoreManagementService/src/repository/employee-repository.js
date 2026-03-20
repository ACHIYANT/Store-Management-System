// ! Repository folder is to have the interactions with the model and database.

const { Employee, Custodian } = require("../models/index");
const { Op } = require("sequelize");
const {
  decodeCursor,
  encodeCursor,
  normalizeLimit,
  applyIdDescCursor,
} = require("../utils/cursor-pagination");

class EmployeeRepository {
  async createEmployee(data) {
    try {
      console.log(
        "Trying to create Employee in the try block of repository layer."
      );
      const employee = await Employee.create(data);
      await Custodian.upsert({
        id: String(employee.emp_id),
        custodian_type: "EMPLOYEE",
        display_name: employee.name,
        location: employee.office_location || null,
        employee_id: employee.emp_id,
        is_active: true,
      });
      return employee;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async deleteEmployee(empId) {
    try {
      await Employee.destroy({
        where: {
          emp_id: empId,
        },
      });
      await Custodian.destroy({
        where: {
          employee_id: empId,
        },
      });
      return true;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async updateEmployee(empId, data) {
    try {
      const [updatedRowsCount] = await Employee.update(data, {
        where: {
          emp_id: empId,
        },
      });

      if (updatedRowsCount === 0) {
        // No vendor found with the given id
        throw new Error("Employee not found or no changes made");
      }

      const updatedEmployee = await Employee.findByPk(empId);
      if (updatedEmployee) {
        await Custodian.upsert({
          id: String(updatedEmployee.emp_id),
          custodian_type: "EMPLOYEE",
          display_name: updatedEmployee.name,
          location: updatedEmployee.office_location || null,
          employee_id: updatedEmployee.emp_id,
          is_active: true,
        });
      }
      return updatedEmployee;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getEmployee(empId) {
    try {
      //   const vendor = await Vendor.findByPk(vendorId);
      const employee = await Employee.findByPk(empId);
      return employee;
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async getAllEmployees({
    search = "",
    division = "",
    page = null,
    limit = null,
    cursor = null,
    cursorMode = false,
  } = {}) {
    try {
      const where = {};
      if (String(division || "").trim() !== "") {
        where.division = String(division).trim();
      }
      const searchTerm = String(search || "").trim();
      if (searchTerm) {
        const like = `%${searchTerm}%`;
        const searchOr = [
          { name: { [Op.like]: like } },
          { father_name: { [Op.like]: like } },
          { email_id: { [Op.like]: like } },
          { designation: { [Op.like]: like } },
          { division: { [Op.like]: like } },
          { group_head: { [Op.like]: like } },
          { office_location: { [Op.like]: like } },
          { mobile_no: { [Op.like]: like } },
        ];

        const numericSearch = Number(searchTerm);
        if (Number.isFinite(numericSearch)) {
          searchOr.unshift({ emp_id: numericSearch });
        }
        where[Op.or] = searchOr;
      }

      const order = [["emp_id", "DESC"]];
      const useCursorMode = Boolean(cursorMode) && limit != null;

      if (useCursorMode) {
        const safeLimit = normalizeLimit(limit, 100, 500);
        const cursorParts = decodeCursor(cursor);
        const cursorWhere = applyIdDescCursor(where, cursorParts, "emp_id");

        const rowsWithExtra = await Employee.findAll({
          where: cursorWhere,
          order,
          limit: safeLimit + 1,
        });

        const hasMore = rowsWithExtra.length > safeLimit;
        const rows = hasMore ? rowsWithExtra.slice(0, safeLimit) : rowsWithExtra;
        const nextCursor =
          hasMore && rows.length
            ? encodeCursor({ emp_id: rows[rows.length - 1].emp_id })
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
        const { rows, count } = await Employee.findAndCountAll({
          where,
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

      return await Employee.findAll({ where, order });
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }

  async searchEmployeeByName(name, options = {}) {
    try {
      return await this.getAllEmployees({
        ...options,
        search: name || "",
      });
    } catch (error) {
      console.log("Something went wrong in the repository layer.");
      throw { error };
    }
  }
}

module.exports = EmployeeRepository;
