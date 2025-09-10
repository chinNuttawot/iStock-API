const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const saveDocumentsNAV = async (req, res) => {
  try {
    const pool = await poolPromise;

    return responseSuccess(res, "save Documents NAV");
  } catch (err) {
    console.error("Error save Documents NAV:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { saveDocumentsNAV };
