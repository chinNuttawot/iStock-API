// controllers/document.controller.js
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { sql, poolPromise } = require("../../config/db");
const { getMenuType, formatDate, formatDateTime } = require("../Card");

/** แปลง DD/MM/พ.ศ. -> JS Date (LOCAL 00:00) */
function parseThaiDateToJSDate(ddmmyyyy_thai) {
  if (!ddmmyyyy_thai) return null;
  const [dd, mm, yyyyThai] = ddmmyyyy_thai
    .split("/")
    .map((v) => parseInt(v, 10));
  if (!dd || !mm || !yyyyThai) return null;
  const yyyy = yyyyThai - 543;
  // ใช้ local time เพื่อให้ CAST(date) ใน SQL จับวันเดียวกันแน่นอน
  return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
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

/** GET /documents?... */
const GetDocuments = async (req, res) => {
  try {
    const pool = await poolPromise;

    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(req.query.pageSize ?? "20", 10), 1),
      200
    );

    const isApprover =
      String(req.query.isApprover ?? "").toLowerCase() === "true";
    const branchCode = req.query.branchCode ?? null;
    const docNo = req.query.docNo ?? null;
    const status = req.query.status ?? null;
    const menuId = req.query.menuId ? parseInt(req.query.menuId, 10) : null;
    const locationCodeFrom = req.query.locationCodeFrom ?? null;
    const binCodeFrom = req.query.binCodeFrom ?? null;
    const createdBy = req.query.createdBy?.trim() || null;

    // ✅ ใช้ createdAt (ไทย DD/MM/พ.ศ.) เทียบเฉพาะ "วัน" เดียว
    const createdAtTH = req.query.createdAt ?? null;
    let createdDateOnly = null;
    if (createdAtTH) {
      const d = parseThaiDateToJSDate(createdAtTH);
      if (!d || isNaN(d.getTime())) {
        return responseError(
          res,
          "รูปแบบวันที่ createdAt ไม่ถูกต้อง (ควรเป็น DD/MM/พ.ศ.)",
          400
        );
      }
      createdDateOnly = d;
    }

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

    // -------- where ----------
    const whereParts = [];
    if (status) whereParts.push("d.[status] = @status");

    // docNo: insensitive + prefix match
    if (docNo) whereParts.push("UPPER(d.[docNo]) LIKE UPPER(@docNo)");

    if (menuId !== null && !Number.isNaN(menuId))
      whereParts.push("d.[menuId] = @menuId");
    if (locationCodeFrom)
      whereParts.push("d.[locationCodeFrom] = @locationCodeFrom");
    if (binCodeFrom) whereParts.push("d.[binCodeFrom] = @binCodeFrom");

    if (createdBy && !isApprover) whereParts.push("d.[createdBy] = @createdBy");

    if (isApprover && branchCode) {
      const branches = branchCode
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      if (branches.length > 0) {
        whereParts.push(
          `d.[branchCode] IN (${branches.map((_, i) => `@br${i}`).join(",")})`
        );
      }
    }

    // ✅ createdAt เฉพาะวันเดียว (กัน timezone ด้วย CAST(date))
    if (createdDateOnly) {
      whereParts.push("CAST(d.[createdAt] AS date) = @createdDate");
    }

    if (stockDateFromTH) whereParts.push("d.[stockOutDate] >= @stockFrom");
    if (stockDateToTH) whereParts.push("d.[stockOutDate] <= @stockTo");

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    // -------- bind ----------
    const listReq = new sql.Request(pool);

    if (status) listReq.input("status", sql.NVarChar(50), status);

    if (docNo) listReq.input("docNo", sql.NVarChar(50), `${docNo}%`); // prefix match

    if (menuId !== null && !Number.isNaN(menuId))
      listReq.input("menuId", sql.Int, menuId);
    if (locationCodeFrom)
      listReq.input("locationCodeFrom", sql.NVarChar(50), locationCodeFrom);
    if (binCodeFrom)
      listReq.input("binCodeFrom", sql.NVarChar(50), binCodeFrom);

    if (createdBy && !isApprover)
      listReq.input("createdBy", sql.NVarChar(100), createdBy);

    if (isApprover && branchCode) {
      const branches = branchCode
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      branches.forEach((br, i) =>
        listReq.input(`br${i}`, sql.NVarChar(50), br)
      );
    }

    // ✅ bind createdAt (date only)
    if (createdDateOnly) {
      listReq.input("createdDate", sql.Date, createdDateOnly);
    }

    if (stockDateFromTH) listReq.input("stockFrom", sql.Date, stockDateFromTH);
    if (stockDateToTH) listReq.input("stockTo", sql.Date, stockDateToTH);

    listReq.input("limit", sql.Int, pageSize);
    listReq.input("offset", sql.Int, offset);

    // -------- query ----------
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
        d.[branchCode],
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
      menuType: getMenuType(item.menuId),
      menuId: item.menuId,
      branchCode: item.branchCode,
      status: item.status,
      date: `สร้างวันที่ ${formatDateTime(item.createdAt)}`,
      details: [
        {
          label:
            item.menuId === 1
              ? "วันที่ตัดสินค้า"
              : item.menuId === 2
              ? "วันที่โอนย้าย"
              : "วันที่ตรวจสินค้า",
          value: formatDate(item.stockOutDate),
        },
        ...(item.menuId !== 2
          ? [
              { label: "คลังหลัก", value: `${item.locationCodeFrom}` },
              { label: "คลังย่อย", value: `${item.binCodeFrom}` },
            ]
          : [
              { label: "คลังหลัก (ต้นทาง)", value: `${item.locationCodeFrom}` },
              { label: "คลังย่อย (ต้นทาง)", value: `${item.binCodeFrom}` },
              { label: "คลังหลัก (ปลายทาง)", value: `${item.locationCodeTo}` },
              { label: "คลังย่อย (ปลายทาง)", value: `${item.binCodeTo}` },
            ]),
        { label: "หมายเหตุ", value: item.remark || "-" },
      ],
    }));

    return responseSuccess(res, "Get documents successfully", recordset);
  } catch (err) {
    return responseError(res, "Failed to get documents");
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
          d.[status],
          d.[locationCodeTo],
          d.[binCodeTo]
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
      quantity: item.quantity,
      serialNo: item.serialNo,
      remark: item.remark || "",
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
    return responseError(res, "Failed to get document");
  }
};

/** GET /documents/:docNo/products → คืนเฉพาะ products */
const GetDocumentProductsByDocNo = async (req, res) => {
  const { docNo } = req.params;
  const { menuId } = req.query;

  if (!docNo) return responseError(res, "docNo is required", 400);
  if (!menuId) return responseError(res, "menuId is required", 400);

  try {
    const pool = await poolPromise;
    const pReq = new sql.Request(pool);
    const pRs = await pReq
      .input("docNo", sql.VarChar(50), docNo)
      .input("menuId", sql.VarChar(50), menuId).query(`
        SELECT
          dp.[id],
          dp.[uuid],
          dp.[docNo],
          dp.[productCode],
          dp.[model],
          dp.[quantity],
          dp.[serialNo],
          dp.[picURL],
          dp.[remark],
          d.[menuId] -- join เพื่อเอามาแปลง menuType
        FROM [DocumentProducts iStock] dp
        INNER JOIN [Documents iStock] d ON d.[docNo] = dp.[docNo]
        WHERE dp.[docNo] = @docNo AND d.[menuId] = @menuId
        ORDER BY dp.[id] ASC
      `);

    const recordset = (pRs.recordset || []).map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(item.menuId),
      menuId: item.menuId,
      model: item.model,
      uuid: item.uuid,
      picURL: item.picURL,
      details: [
        { label: "จำนวน", value: item.quantity },
        { label: "รหัสแบบ", value: item.model },
        { label: "serial No.", value: item.serialNo },
        { label: "หมายเหตุ", value: item.remark || "-" },
      ],
    }));

    return responseSuccess(res, "Get products successfully", recordset);
  } catch (err) {
    return responseError(res, "Failed to get products");
  }
};

// GET /documents-send-NAV?docNo=MC-250829-5200|MO-250828-0001
const GetDocumentsByDocNos = async (req, res) => {
  const { docNo } = req.query;
  if (!docNo) return responseError(res, "docNo is required", 400);

  const docNos = String(docNo)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  if (docNos.length === 0) {
    return responseError(res, "No valid docNo provided", 400);
  }

  try {
    const pool = await poolPromise;
    const placeholders = docNos.map((_, i) => `@doc${i}`).join(", ");
    const orderByCase = docNos
      .map((_, i) => `WHEN @doc${i} THEN ${i}`)
      .join(" ");

    const hReq = new sql.Request(pool);
    docNos.forEach((d, i) => hReq.input(`doc${i}`, sql.VarChar(50), d));

    const hSql = `
      SELECT *
      FROM [Documents iStock] d
      WHERE d.[docNo] IN (${placeholders})
      ORDER BY CASE d.[docNo] ${orderByCase} ELSE 999999 END
    `;

    const hRs = await hReq.query(hSql);
    const headers = hRs.recordset || [];
    if (headers.length === 0) {
      return res.json([]);
    }

    const headerByDoc = new Map(headers.map((h) => [h.docNo, h]));

    const pReq = new sql.Request(pool);
    docNos.forEach((d, i) => pReq.input(`doc${i}`, sql.VarChar(50), d));

    const pSql = `
      SELECT *
      FROM [DocumentProducts iStock] dp
      WHERE dp.[docNo] IN (${placeholders})
      ORDER BY CASE dp.[docNo] ${orderByCase} ELSE 999999 END, dp.[id] ASC
    `;

    const pRs = await pReq.query(pSql);
    const products = pRs.recordset || [];
    const rows = products.map((item) => {
      const h = headerByDoc.get(item.docNo) || {};
      return {
        docNo: h.docNo || item.docNo,
        menuId: h.menuId,
        menuName: h.menuName,
        stockOutDate: h.stockOutDate,
        remark: h.remark,
        locationCodeFrom: h.locationCodeFrom,
        binCodeFrom: h.binCodeFrom,
        createdAt: h.createdAt,
        createdBy: h.createdBy,
        status: h.status,
        locationCodeTo: h.locationCodeTo ?? "",
        binCodeTo: h.binCodeTo ?? "",
        uuid: String(item.uuid || "").toLowerCase(),
        menuType: h.menuId != null ? getMenuType(h.menuId) : undefined,
        model: item.model,
        quantity: item.quantity,
        serialNo: item.serialNo,
        remarkProduct: item.remark || "",
      };
    });
    return res.json(rows);
  } catch (err) {
    return responseError(res, `Failed to get documents: ${err.message}`, 500);
  }
};

module.exports = {
  GetDocuments,
  GetDocumentByDocNo,
  GetDocumentProductsByDocNo,
  GetDocumentsByDocNos,
};
