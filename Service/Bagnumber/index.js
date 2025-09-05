const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

async function GetBagNumber(req, res) {
  try {
    if (!req.query.branchCode)
      return responseError(res, "branchCode is required", 400);

    const branchCode = (req.query.branchCode || "").trim();
    const STATUS = "Pending Approval";
    const pool = await poolPromise;
    const pReq = new sql.Request(pool);
    const whereParts = [];
    pReq.input("status", sql.VarChar(50), STATUS);
    whereParts.push("d.[status] = @status");

    if (branchCode) {
      const branches = branchCode
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);

      if (branches.length > 0) {
        const placeholders = branches.map((_, i) => `@br${i}`).join(", ");
        whereParts.push(`d.[branchCode] IN (${placeholders})`);
        branches.forEach((br, i) => {
          pReq.input(`br${i}`, sql.VarChar(20), br);
        });
      }
    }

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";
    const sqlText = `
      SELECT COUNT(1) AS bagNumber
      FROM [Documents iStock] d
      ${whereSql};
    `;

    const rs = await pReq.query(sqlText);
    const bagNumber = rs.recordset?.[0]?.bagNumber ?? 0;
    return responseSuccess(res, "Bag number fetched", bagNumber);
  } catch (err) {
    return responseError(res, "ไม่สามารถดึง bagnumber ได้", 500);
  }
}

module.exports = {
  GetBagNumber,
};
