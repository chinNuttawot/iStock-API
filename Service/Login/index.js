const axios = require("axios");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { getByUserNAV } = require("../NAV");

const Login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return responseError(res, "Username and password required", 400);
  }

  // ถ้า client ส่ง password มาเป็น base64 ให้ถอดก่อน
  let inputPassword;
  try {
    inputPassword = Buffer.from(password, "base64").toString("utf8");
  } catch {
    // ถ้าถอดไม่ได้ ก็ถือว่า client ส่ง plain มา
    inputPassword = password;
  }

  try {
    const pool = await poolPromise;

    // 1) หาจาก DB ก่อน
    const result = await pool
      .request()
      .input("username", sql.VarChar, username)
      .query(`SELECT * FROM [User iStock] WHERE [User Name] = @username`);

    // 1.1) ไม่พบใน DB ⇒ ลอง auth กับ NAV
    if (result.recordset.length === 0) {
      try {
        const navUser = await getByUserNAV(username);

        if (!navUser) {
          return responseError(_value, "User not found", 401);
        }

        if (inputPassword !== navUser.password) {
          return responseError(res, "Invalid password", 401);
        }
        
        if (!navUser?.branchCode) {
          return responseError(res, "ติดต่อ NAV", 400);
        }

        // // ผ่าน ⇒ ออก token เลย (ไม่บันทึก DB เพราะไม่มี record)
        const jwtToken = jwt.sign(
          { username, from: "NAV" },
          process.env.JWT_SECRET,
          {
            algorithm: "HS256",
            expiresIn: "1h",
          }
        );

        return responseSuccess(res, "Login successful (NAV)", {
          token: jwtToken,
          from: "NAV",
        });
      } catch (err) {
        console.error("NAV auth error:", err?.message || err);
        if (!res.headersSent) {
          return responseError(res, "User not found", 401);
        }
        return; // กันส่งซ้ำ
      }
    }

    // 1.2) พบใน DB ⇒ ตรวจต่อ
    const dbUser = result.recordset[0];

    // กัน undefined/null (บางตารางเก็บเป็น bit/0/1/true/false)
    const isActive = Boolean(
      dbUser.Actived ?? dbUser.Active ?? dbUser.IsActive ?? true
    );
    if (!isActive) {
      return responseError(res, "User account has been deactivated", 401);
    }

    // ถอดรหัสรหัสผ่านที่เก็บใน DB (base64)
    let storedPassword = "";
    try {
      storedPassword = Buffer.from(dbUser.Password || "", "base64").toString(
        "utf8"
      );
    } catch {
      storedPassword = dbUser.Password || "";
    }

    if (inputPassword !== storedPassword) {
      return responseError(res, "Invalid password", 401);
    }

    // ผ่าน ⇒ ออก token และอัปเดต DB
    const jwtToken = jwt.sign(
      { username, from: "DB" },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "1h",
      }
    );

    await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("token", sql.VarChar, jwtToken).query(`
        UPDATE [User iStock]
        SET [CurrentToken] = @token,
            [LastLoginAT] = GETDATE()
        WHERE [User Name] = @username
      `);

    return responseSuccess(res, "Login successful", {
      token: jwtToken,
      from: "DB",
    });
  } catch (err) {
    console.error("Login error:", err);
    if (!res.headersSent) {
      return responseError(res, "Server error", 500);
    }
  }
};

module.exports = { Login };
