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

    // Query User by [User Name]
    const result = await pool.request().input("username", sql.VarChar, username)
      .query(`
        SELECT * FROM [User iStock] WHERE [User Name] = @username
      `);

    if (result.recordset.length === 0) {
      return responseError(res, "User not found", 401);
    }

    const user = result.recordset[0];

    if (!user.Actived) {
      return responseError(res, "User account has been deactivated", 401);
    }

    // Decode password
    const inputPassword = Buffer.from(password, "base64").toString("utf8");
    const storedPassword = Buffer.from(user.Password, "base64").toString(
      "utf8"
    );

    if (inputPassword !== storedPassword) {
      return responseError(res, "Invalid password", 401);
    }

    // Generate JWT Token
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      algorithm: "HS256",
    });

    // Update CurrentToken and LastLoginAT
    await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("token", sql.VarChar, token).query(`
        UPDATE [User iStock]
        SET [CurrentToken] = @token,
            [LastLoginAT] = GETDATE()
        WHERE [User Name] = @username
      `);

    return responseSuccess(res, "Login successful", { token });
  } catch (err) {
    console.error("Login error", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { Login };
