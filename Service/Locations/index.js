// controllers/locationController.js
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const getLocations = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT
        LTRIM(RTRIM([Code])) AS [key],
        LTRIM(RTRIM([Code])) AS [value]
      FROM [FAM_GOLIVE$Location]
      WHERE LTRIM(RTRIM([Code])) <> ''
      ORDER BY [key]
    `);

    return responseSuccess(
      res,
      "Destination location list fetched",
      result.recordset
    );
  } catch (err) {
    console.error("Error fetching destination locations:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { getLocations };
