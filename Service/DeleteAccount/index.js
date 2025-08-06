const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const deleteAccount = async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return responseError(res, "Unauthorized - No token provided", 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return responseError(res, "Unauthorized - Invalid token", 401);
  }

  const username = decoded.username;

  try {
    const pool = await poolPromise;

    // Soft Delete: Set Actived = 0
    await pool.request().input("username", sql.VarChar, username).query(`
        UPDATE [User iStock]
        SET [Actived] = 0,
            [ActivedAT] = GETDATE()
        WHERE [User Name] = @username
      `);

    return responseSuccess(res, "Account deactivated successfully");
  } catch (err) {
    console.error("Delete Account error:", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { deleteAccount };
