// controllers/binController.js
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const getBinCodesByLocation = async (req, res) => {
  try {
    const { locationCodeFrom } = req.query;

    if (!locationCodeFrom) {
      return responseError(res, "locationCodeFrom is required", 400);
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("locationCodeFrom", sql.VarChar, locationCodeFrom).query(`
        SELECT DISTINCT
          LTRIM(RTRIM([Code])) AS [key],
          LTRIM(RTRIM([Code])) AS [value]
        FROM [FAM_GOLIVE$Bin]
        WHERE [Location Code] COLLATE SQL_Latin1_General_CP1_CI_AS = @locationCodeFrom
          AND [Warehouse Center] = 1
          AND LTRIM(RTRIM([Code])) <> ''
        ORDER BY [key]
      `);

    return responseSuccess(res, "Bin code list fetched", result.recordset);
  } catch (err) {
    console.error("Error fetching bin codes by location:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { getBinCodesByLocation };
