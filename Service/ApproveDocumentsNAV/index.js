const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { sendIStockStaging } = require("../NAV");

const ApproveDocumentsNAV = async (req, res) => {
  try {
    const { status, docNo } = req.body || {};
    if (!status) return responseError(res, "status not found", 401);
    if (!docNo) return responseError(res, "docNo not found", 401);
    if (status !== "Approved") {
      return responseSuccess(res, "Approve Documents NAV");
    }
    const docNos = String(docNo)
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (docNos.length === 0) {
      return responseError(res, "docNo is empty", 401);
    }
    const valuesRows = docNos.map((_, i) => `(@doc${i})`).join(", ");
    const docNosCte = `WITH DocNos AS (SELECT v.docNo FROM (VALUES ${valuesRows}) AS v(docNo))`;
    const q = `
      ${docNosCte}
      SELECT 
        d.docNo,
        dp.id               AS docLineNo,
        d.menuId            AS menuID,
        d.menuName,
        d.stockOutDate,
        d.remark,
        d.locationCodeFrom,
        d.binCodeFrom,
        d.createdAt,
        d.createdBy,
        d.status,
        d.locationCodeTo,
        d.binCodeTo,
        dp.uuid,
        dp.model,
        dp.quantity,
        dp.serialNo,
        dp.remark           AS remarkProduct
      FROM [FAC-DEV11].[dbo].[Documents iStock] d
      INNER JOIN DocNos dn
        ON dn.docNo = d.docNo
      INNER JOIN [FAC-DEV11].[dbo].[DocumentProducts iStock] dp
        ON dp.docNo = d.docNo
      ORDER BY d.docNo, dp.id;
    `;

    const pool = await poolPromise;
    const reqDb = pool.request();
    docNos.forEach((v, i) => {
      reqDb.input(`doc${i}`, sql.NVarChar(100), v);
    });

    const rs = await reqDb.query(q);
    const replaceNulls = (obj) => {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) {
          out[k] = "";
        } else if (v instanceof Date) {
          out[k] = v.toISOString();
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    const rows = (rs.recordset || []).map((r) => {
      const o = replaceNulls(r);
      o.menuID = Number(o.menuID);
      o.docLineNo = 0;
      o.quantity = Number(o.quantity);
      o.status = "Open";
      if ([0, 1, 3].includes(o.menuID)) {
        const fromLoc = o.locationCodeFrom || "";
        const fromBin = o.binCodeFrom || "";
        o.locationCodeTo = fromLoc;
        o.binCodeTo = fromBin;
        o.locationCodeFrom = "";
        o.binCodeFrom = "";
      }
      return o;
    });

    for (const p of rows) {
      await sendIStockStaging(p);
    }
    return responseSuccess(res, "Approve Documents NAV");
  } catch (err) {
    console.error("Error Approve Documents NAV:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { ApproveDocumentsNAV };
