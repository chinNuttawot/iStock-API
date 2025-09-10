const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const ApproveDocumentsNAV = async (req, res) => {
  try {
    const pool = await poolPromise;

    return responseSuccess(res, "Approve Documents NAV");
  } catch (err) {
    console.error("Error Approve Documents NAV:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { ApproveDocumentsNAV };
