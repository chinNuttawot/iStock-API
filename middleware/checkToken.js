const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../config/db");

// ✅ เพิ่มตัวแปร global
const revokedTokens = new Set();

const checkToken = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  if (revokedTokens.has(token)) {
    return res.status(401).json({ message: "Token has been revoked" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("username", sql.VarChar, decoded.username)
      .query("SELECT currentToken FROM Users WHERE username = @username");

    const userToken = result.recordset[0]?.currentToken;

    if (userToken !== token) {
      return res.status(401).json({ message: "Session expired" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ✅ Export ตัวนี้ออกไปด้วย
module.exports = {
  checkToken,
  revokedTokens,
};
