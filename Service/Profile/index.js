const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const GetProfile = async (req, res) => {
  const username = req.user?.username;

  if (!username) {
    return responseError(res, "Unauthorized", 401);
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request().input("username", sql.VarChar, username)
      .query(`
        SELECT 
          id, username, firstName, lastName, department, branch,
          email, lineId, phoneNumber, lastLoginAt
        FROM Users
        WHERE username = @username
      `);

    if (result.recordset.length === 0) {
      return responseError(res, "User not found", 404);
    }

    const user = result.recordset[0];
    return responseSuccess(res, "Profile loaded", user);
  } catch (err) {
    console.error("GetProfile error:", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { GetProfile };
