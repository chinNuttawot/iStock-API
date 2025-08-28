// controllers/document.controller.js
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { sql, poolPromise } = require("../../config/db");
const { getMenuType, formatDate } = require("../Card");

/** แปลง DD/MM/พ.ศ. -> JS Date (UTC 00:00) */
function parseThaiDateToJSDate(ddmmyyyy_thai) {
  if (!ddmmyyyy_thai) return null;
  const [dd, mm, yyyyThai] = ddmmyyyy_thai
    .split("/")
    .map((v) => parseInt(v, 10));
  if (!dd || !mm || !yyyyThai) return null;
  const yyyy = yyyyThai - 543;
  return new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
}

/** สร้าง ORDER BY ที่ปลอดภัย */
function buildOrderBy(sortBy = "createdAt", sortDir = "DESC") {
  const allowedCols = new Set([
    "docNo",
    "menuId",
    "menuName",
    "stockOutDate",
    "createdAt",
    "status",
    "locationCodeFrom",
    "binCodeFrom",
  ]);
  const col = allowedCols.has(sortBy) ? sortBy : "createdAt";
  const dir = String(sortDir).toUpperCase() === "ASC" ? "ASC" : "DESC";
  return { col, dir };
}

/** GET /documents?page=&pageSize=&status=&menuId=&locationCodeFrom=&binCodeFrom=&createdBy=&createdFrom=&createdTo=&stockDateFromTH=&stockDateToTH=&sortBy=&sortDir= */
const GetDocuments = async (req, res) => {
  try {
    const pool = await poolPromise;

    // -------- query params ----------
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(req.query.pageSize ?? "20", 10), 1),
      200
    );

    const status = req.query.status ?? null;
    const menuId = req.query.menuId ? parseInt(req.query.menuId, 10) : null;
    const locationCodeFrom = req.query.locationCodeFrom ?? null;
    const binCodeFrom = req.query.binCodeFrom ?? null;
    const createdBy = req.query.createdBy?.trim() || null;

    // createdAt: ใช้ ISO (เช่น 2025-08-01)
    const createdFrom = req.query.createdFrom
      ? new Date(req.query.createdFrom)
      : null;
    const createdTo = req.query.createdTo
      ? new Date(req.query.createdTo)
      : null;

    // stockOutDate (ไทย DD/MM/พ.ศ.)
    const stockDateFromTH = req.query.stockDateFromTH
      ? parseThaiDateToJSDate(req.query.stockDateFromTH)
      : null;
    const stockDateToTH = req.query.stockDateToTH
      ? parseThaiDateToJSDate(req.query.stockDateToTH)
      : null;

    const { col: sortCol, dir: sortDir } = buildOrderBy(
      req.query.sortBy,
      req.query.sortDir
    );
    const offset = (page - 1) * pageSize;

    // -------- สร้าง where เงื่อนไข ----------
    const whereParts = [];
    if (status) whereParts.push("d.[status] = @status");
    if (menuId !== null && !Number.isNaN(menuId))
      whereParts.push("d.[menuId] = @menuId");
    if (locationCodeFrom)
      whereParts.push("d.[locationCodeFrom] = @locationCodeFrom");
    if (binCodeFrom) whereParts.push("d.[binCodeFrom] = @binCodeFrom");

    if (createdBy) {
      // ใช้ createdBy เป็นคีย์เวิร์ดค้นหลายคอลัมน์ (หากต้องการให้ค้นเฉพาะผู้สร้าง เปลี่ยนเป็น d.[createdBy] = @createdBy)
      whereParts.push(
        "(d.[docNo] LIKE @kw OR d.[menuName] LIKE @kw OR d.[locationCodeFrom] LIKE @kw OR d.[binCodeFrom] LIKE @kw)"
      );
    }
    if (createdFrom) whereParts.push("d.[createdAt] >= @createdFrom");
    if (createdTo)
      whereParts.push("d.[createdAt] < DATEADD(day, 1, @createdTo)"); // รวมทั้งวัน

    if (stockDateFromTH) whereParts.push("d.[stockOutDate] >= @stockFrom");
    if (stockDateToTH) whereParts.push("d.[stockOutDate] <= @stockTo");

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    // -------- query หน้า (ไม่ต้องนับ total อีกต่อไป) ----------
    const listReq = new sql.Request(pool);
    if (status) listReq.input("status", sql.NVarChar(50), status);
    if (menuId !== null && !Number.isNaN(menuId))
      listReq.input("menuId", sql.Int, menuId);
    if (locationCodeFrom)
      listReq.input("locationCodeFrom", sql.NVarChar(50), locationCodeFrom);
    if (binCodeFrom)
      listReq.input("binCodeFrom", sql.NVarChar(50), binCodeFrom);
    if (createdBy) listReq.input("kw", sql.NVarChar(200), `%${createdBy}%`);
    if (createdFrom) listReq.input("createdFrom", sql.DateTime2, createdFrom);
    if (createdTo) listReq.input("createdTo", sql.DateTime2, createdTo);
    if (stockDateFromTH) listReq.input("stockFrom", sql.Date, stockDateFromTH);
    if (stockDateToTH) listReq.input("stockTo", sql.Date, stockDateToTH);

    listReq.input("limit", sql.Int, pageSize);
    listReq.input("offset", sql.Int, offset);

    const dataSql = `
      SELECT
        d.[docNo],
        d.[menuId],
        d.[menuName],
        d.[stockOutDate],
        d.[remark],
        d.[locationCodeFrom],
        d.[binCodeFrom],
        d.[createdAt],
        d.[createdBy],
        d.[status],
        d.[locationCodeTo],
        d.[binCodeTo],
        (SELECT COUNT(1) FROM [DocumentProducts iStock] dp WHERE dp.[docNo] = d.[docNo]) AS itemsCount
      FROM [Documents iStock] d
      ${whereSql}
      ORDER BY d.[${sortCol}] ${sortDir}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    const rs = await listReq.query(dataSql);

    const recordset = (rs.recordset || []).map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(item.menuId), // ใช้ menuId ของแต่ละเอกสาร
      menuId: item.menuId,
      status: "Open", //"Open" | "Pending Approval" | "Approved" | "Rejected"
      details: [
        { label: "วันที่ตัดสินค้า", value: formatDate(item.stockOutDate) },
        { label: "คลังหลัก", value: `${item.locationCodeFrom}` },
        { label: "คลังย่อย", value: `${item.binCodeFrom}` },
        { label: "หมายเหตุ", value: item.remark || "-" },
      ],
    }));

    // ✅ คืนเฉพาะ array ของรายการ (ไม่มี page/pageSize/total/totalPages)
    return responseSuccess(res, "Get documents successfully", recordset);
  } catch (err) {
    return responseError(res, "Failed to get documents", err.message);
  }
};

/** GET /documents/:docNo  → header + products[] */
const GetDocumentByDocNo = async (req, res) => {
  const { docNo } = req.params;
  if (!docNo) return responseError(res, "docNo is required", 400);

  try {
    const pool = await poolPromise;

    // header
    const hReq = new sql.Request(pool);
    const hRs = await hReq.input("docNo", sql.VarChar(50), docNo).query(`
        SELECT
          d.[docNo],
          d.[menuId],
          d.[menuName],
          d.[stockOutDate],
          d.[remark],
          d.[locationCodeFrom],
          d.[binCodeFrom],
          d.[createdAt],
          d.[createdBy],
          d.[status]
        FROM [Documents iStock] d
        WHERE d.[docNo] = @docNo
      `);

    if (!hRs.recordset || hRs.recordset.length === 0) {
      return responseError(res, `Document ${docNo} not found`, 404);
    }
    const header = hRs.recordset[0];

    // products
    const pReq = new sql.Request(pool);
    const pRs = await pReq.input("docNo", sql.VarChar(50), docNo).query(`
        SELECT
          dp.[id],
          dp.[uuid],
          dp.[docNo],
          dp.[productCode],
          dp.[model],
          dp.[quantity],
          dp.[serialNo],
          dp.[remark]
        FROM [DocumentProducts iStock] dp
        WHERE dp.[docNo] = @docNo
        ORDER BY dp.[id] ASC
      `);

    const products = (pRs.recordset || []).map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(header.menuId), // อิงจาก header
      menuId: header.menuId,
      model: item.model,
      details: [
        { label: "จำนวน", value: item.quantity },
        { label: "รหัสแบบ", value: item.model },
        { label: "serial No.", value: item.serialNo },
        { label: "หมายเหตุ", value: item.remark || "-" },
      ],
    }));

    return responseSuccess(res, "Get document successfully", {
      ...header,
      products,
    });
  } catch (err) {
    return responseError(res, "Failed to get document", err.message);
  }
};

/** GET /documents/:docNo/products → คืนเฉพาะ products */
const GetDocumentProductsByDocNo = async (req, res) => {
  const { docNo } = req.params;
  if (!docNo) return responseError(res, "docNo is required", 400);

  try {
    const pool = await poolPromise;
    const pReq = new sql.Request(pool);
    const pRs = await pReq.input("docNo", sql.VarChar(50), docNo).query(`
        SELECT
          dp.[id],
          dp.[uuid],
          dp.[docNo],
          dp.[productCode],
          dp.[model],
          dp.[quantity],
          dp.[serialNo],
          dp.[remark],
          d.[menuId] -- join เพื่อเอามาแปลง menuType
        FROM [DocumentProducts iStock] dp
        INNER JOIN [Documents iStock] d ON d.[docNo] = dp.[docNo]
        WHERE dp.[docNo] = @docNo
        ORDER BY dp.[id] ASC
      `);

    const recordset = (pRs.recordset || []).map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(item.menuId),
      menuId: item.menuId,
      model: item.model,
      details: [
        { label: "จำนวน", value: item.quantity },
        { label: "รหัสแบบ", value: item.model },
        { label: "serial No.", value: item.serialNo },
        { label: "หมายเหตุ", value: item.remark || "-" },
      ],
    }));

    return responseSuccess(res, "Get products successfully", recordset);
  } catch (err) {
    return responseError(res, "Failed to get products", err.message);
  }
};

module.exports = {
  GetDocuments,
  GetDocumentByDocNo,
  GetDocumentProductsByDocNo,
};
