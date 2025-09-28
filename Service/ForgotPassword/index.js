const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

// POST /api/forgot-password
// body: { "username": "someone", "newPassword": "xxxxxx" (base64) }
const ForgotPassword = async (req, res) => {
  try {
    const { username, newPassword } = req.body || {};

    if (!username) return responseError(res, "username not found", 401);
    if (!newPassword) return responseError(res, "newPassword not found", 401);

    const pool = await poolPromise;
    const checkReq = new sql.Request(pool);
    checkReq.input("username", sql.NVarChar, username.trim());
    const checkSql = `
      SELECT TOP (1) [ID], [User Name]
      FROM [User iStock]
      WHERE [User Name] = @username
    `;
    const checkResult = await checkReq.query(checkSql);

    if (checkResult.recordset.length === 0) {
      return responseError(res, "username not found in system", 400);
    }
    const updateReq = new sql.Request(pool);
    updateReq.input("username", sql.NVarChar, username.trim());
    updateReq.input("pwd", sql.NVarChar, newPassword);
    const updateSql = `
      UPDATE [User iStock]
      SETฃ

        [Password] = @pwd,
        [Sync] = 1,
        [SyncAt] = GETDATE()
      WHERE [User Name] = @username
    `;
    await updateReq.query(updateSql);

    return responseSuccess(res, "Reset password success");
  } catch (err) {
    console.error("ForgotPassword error:", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { ForgotPassword };
