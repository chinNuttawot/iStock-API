const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const Register = async (req, res) => {
  const {
    username,
    firstName,
    lastName,
    department,
    branch,
    password,
    email,
    lineId,
    phoneNumber,
  } = req.body;

  console.log("📦 Body Received:", req.body);

  if (!username || !password) {
    return responseError(res, "Username and password required", 400);
  }

  try {
    const pool = await poolPromise;

    // ตรวจ username ซ้ำ
    const check = await pool
      .request()
      .input("username", sql.VarChar, username)
      .query("SELECT id FROM Users WHERE username = @username");

    if (check.recordset.length > 0) {
      return responseError(res, "Username already exists", 409);
    }

    // บันทึกข้อมูล
    await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("firstName", sql.NVarChar, firstName)
      .input("lastName", sql.NVarChar, lastName)
      .input("department", sql.NVarChar, department)
      .input("branch", sql.NVarChar, branch)
      .input("password", sql.VarChar, password)
      .input("email", sql.VarChar, email)
      .input("lineId", sql.VarChar, lineId)
      .input("phoneNumber", sql.VarChar, phoneNumber).query(`
        INSERT INTO Users (username, firstName, lastName, department, branch, password, email, lineId, phoneNumber)
        VALUES (@username, @firstName, @lastName, @department, @branch, @password, @email, @lineId, @phoneNumber)
      `);

    return responseSuccess(
      res,
      "Register success",
      {
        username,
        firstName,
        lastName,
        department,
        branch,
        email,
        lineId,
        phoneNumber,
      },
      200
    );
  } catch (err) {
    console.error("Register error:", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { Register };
