const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const Login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return responseError(res, "Username and password required", 400);
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("username", sql.VarChar, username)
      .query("SELECT * FROM Users WHERE username = @username");

    if (result.recordset.length === 0) {
      return responseError(res, "User not found", 401);
    }

    const user = result.recordset[0];
    const inputPassword = Buffer.from(password, "base64").toString("utf8");
    const storedPassword = Buffer.from(user.password, "base64").toString(
      "utf8"
    );

    if (inputPassword !== storedPassword) {
      return responseError(res, "Invalid password", 401);
    }

    // 🔐 สร้าง token ใหม่
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      algorithm: "HS256",
    });

    // ✍️ บันทึก token และเวลา login ล่าสุด
    await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("token", sql.VarChar, token)
      .input("loginAt", sql.DateTime, new Date()).query(`
        UPDATE Users
        SET currentToken = @token,
            lastLoginAt = @loginAt
        WHERE username = @username
      `);

    return responseSuccess(res, "Login successful", {
      token,
    });
  } catch (err) {
    console.error("Login error", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { Login };
