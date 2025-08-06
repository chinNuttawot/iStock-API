const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../config/db");

// ✅ Global variable to store revoked tokens
const revokedTokens = new Set();

const checkToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  if (revokedTokens.has(token)) {
    return res.status(401).json({ message: "Token has been revoked" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pool = await poolPromise;

    // ✅ Correct Table & Column Names
    const result = await pool
      .request()
      .input("username", sql.VarChar, decoded.username).query(`
        SELECT [CurrentToken] FROM [User iStock] WHERE [User Name] = @username
      `);

    const userToken = result.recordset[0]?.CurrentToken;

    if (userToken !== token) {
      return res.status(401).json({ message: "Session expired" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("Token verification error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = {
  checkToken,
  revokedTokens,
};
