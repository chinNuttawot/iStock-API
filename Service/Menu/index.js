const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const getMenus = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT * FROM menus WHERE isActive = 1 ORDER BY sort_order, menu_id"
      );
    return responseSuccess(res, "Menu list fetched", result.recordset);
  } catch (err) {
    console.error("Error fetching menus:", err);
    return responseError(res, "Internal server error", err.message);
  }
};

module.exports = {
  getMenus,
};
