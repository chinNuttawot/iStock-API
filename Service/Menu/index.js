const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const getMenus = async (req, res) => {
  try {
    const isApprover = req.query.isApprover === "true" ?? false;
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT 
          [ID] AS menuId,
          [Label],
          [IconType],
          [IconName],
          [ImagePath],
          [isActive],
          [nameMenu]
        FROM [Menu iStock]
        WHERE [isActive] = 1
        ORDER BY [ID]
      `);

    const dataReturn = result.recordset.filter((v) =>
      isApprover ? v.menuId === 4 || v.menuId === 6 : v.menuId !== 6
    );

    return responseSuccess(res, "Menu list fetched", dataReturn);
  } catch (err) {
    console.error("Error fetching menus:", err);
    return responseError(res, "Internal server error");
  }
};

module.exports = {
  getMenus,
};
