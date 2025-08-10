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
  if (!username || !password) {
    return responseError(res, "Username and password required", 400);
  }

  try {
    const pool = await poolPromise;

    // ตรวจ username ซ้ำ
    const check = await pool.request().input("username", sql.VarChar, username)
      .query(`
        SELECT [ID] 
        FROM [User iStock] 
        WHERE [User Name] = @username
      `);

    if (check.recordset.length > 0) {
      return responseError(res, "Username already exists", 409);
    }

    // 1. Get next ID (MAX(ID) + 1)
    const result = await pool
      .request()
      .query(`SELECT ISNULL(MAX([ID]), 0) + 1 AS nextId FROM [User iStock]`);
    const id = result.recordset[0].nextId;

    // บันทึกข้อมูล
    await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.VarChar, username)
      .input("firstName", sql.NVarChar, firstName)
      .input("lastName", sql.NVarChar, lastName)
      .input("department", sql.NVarChar, department)
      .input("branch", sql.NVarChar, branch)
      .input("password", sql.VarChar, password)
      .input("email", sql.VarChar, email)
      .input("lineId", sql.VarChar, lineId)
      .input("phoneNumber", sql.VarChar, phoneNumber)
      .input("syncAt", sql.DateTime, new Date("1753-01-01T00:00:00.000Z"))
      .query(`
        INSERT INTO [User iStock] 
        ([ID]
        ,[User Name]
        ,[Password]
        ,[First Name]
        ,[Last Name]
        ,[Shortcut Dimension 1 Code]
        ,[Shortcut Dimension 2 Code]
        ,[E-Mail]
        ,[Line ID]
        ,[Phone No_]
        ,[CurrentToken]
        ,[LastLoginAT]
        ,[CreateAt]
        ,[Actived]
        ,[ActivedAT]
        ,[Sync]
        ,[SyncAt])
        VALUES 
          (@id, 
          @username, 
          @password, 
          @firstName, 
          @lastName, 
          @department, 
          @branch, 
          @email, 
          @lineId, 
          @phoneNumber, 
          '', 
          GETDATE(), 
          GETDATE(), 
          1, 
          GETDATE(),
          0,
          @syncAt)
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
