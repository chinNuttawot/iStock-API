const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const getWorkOrderNames = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT * FROM menus WHERE isActive = 1 ORDER BY sort_order, menu_id"
      );

    const filter = result.recordset.map((v) => ({
      value: v.label,
      key: v.menu_id,
    }));
    return responseSuccess(res, "Menu list fetched", [
      ...[{ value: "All", key: "all" }],
      ...filter,
    ]);
  } catch (err) {
    console.error("Error fetching menus:", err);
    return responseError(res, "Internal server error", err.message);
  }
};

module.exports = {
  getWorkOrderNames,
};
