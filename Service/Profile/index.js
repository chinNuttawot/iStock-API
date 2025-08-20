const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { getByUserNAV } = require("../NAV");

const GetProfile = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return responseError(res, "Unauthorized - No token provided", 401);
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return responseError(res, "Unauthorized - Invalid token", 401);
  }

  const username = decoded.username;

  if (!username) {
    return responseError(res, "Unauthorized - Invalid token payload", 401);
  }

  try {
    let user;
    if (decoded.from === "DB") {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("username", sql.VarChar, username).query(`
        SELECT 
          [ID] AS id,
          [User Name] AS username,
          [First Name] AS firstName,
          [Last Name] AS lastName,
          [Shortcut Dimension 1 Code] AS department,
          [Shortcut Dimension 2 Code] AS branch,
          [E-Mail] AS email,
          [Line ID] AS lineId,
          [Phone No_] AS phoneNumber,
          [LastLoginAT] AS lastLoginAt
        FROM [User iStock]
        WHERE [User Name] = @username
      `);

      if (result.recordset.length === 0) {
        return responseError(res, "User not found", 404);
      }

      user = result.recordset[0];
    } else {
      const navUser = await getByUserNAV(username);
      const { password, ...safeUser } = navUser;
      if (!navUser) {
        return responseError(_value, "User not found from NAV", 401);
      }
      user = safeUser;
    }

    return responseSuccess(res, "Profile loaded", user);
  } catch (err) {
    console.error("GetProfile error:", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { GetProfile };
