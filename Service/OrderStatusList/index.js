const { sql, poolPromise } = require("../../config/db");
const { responseSuccess, responseError } = require("../../utils/responseHelper");

const getOrderStatusList = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        [ID], 
        [StatusKey] AS [key], 
        [StatusValue] AS [value]
      FROM [Order Status iStock]
    `);

    return responseSuccess(res, "Order status list fetched", result.recordset);
  } catch (err) {
    console.error("Error fetching order status list:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { getOrderStatusList };
