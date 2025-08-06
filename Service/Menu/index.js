const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const getMenus = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT 
          [ID] AS menuId,
          [Label],
          [IconType],
          [IconName],
          [ImagePath],
          [isActive]
        FROM [Menu iStock]
        WHERE [isActive] = 1
        ORDER BY [ID]
      `);

    return responseSuccess(res, "Menu list fetched", result.recordset);
  } catch (err) {
    console.error("Error fetching menus:", err);
    return responseError(res, "Internal server error", err.message);
  }
};

module.exports = {
  getMenus,
};
