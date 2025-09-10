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
  return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0); // local midnight
}

/** แปลง JS Date (local) -> 'YYYY-MM-DD' (local) เพื่อกัน timezone shift */
function formatJSDateToYMDLocal(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

/**
 * NORMALIZE_DATE_SQL(col):
 * รองรับคอลัมน์ที่เป็น nvarchar ทั้งกรณี AD/Persists เป็น datetime,
 * และกรณีเก็บเป็น 'พ.ศ.-MM-dd' เช่น '2568-09-05' (อาจมีเวลา)
 * ลอจิก:
 *   1) ถ้า TRY_CONVERT(date, col) ได้ → ใช้ทันที
 *   2) ถ้า TRY_CONVERT(date, LEFT(col,10)) ได้ → ใช้ทันที
 *   3) ไม่ได้ทั้งคู่ → ตีความซ้าย 10 ตัวเป็น 'yyyy-MM-dd'
 *      แยกปี/เดือน/วัน แล้ว DATEFROMPARTS(ปี - 543 ถ้า > 2200, เดือน, วัน)
 */
const NORMALIZE_DATE_SQL = (colExpr) => `
  CASE
    WHEN TRY_CONVERT(date, ${colExpr}) IS NOT NULL
      THEN TRY_CONVERT(date, ${colExpr})
    WHEN TRY_CONVERT(date, LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10)) IS NOT NULL
      THEN TRY_CONVERT(date, LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10))
    ELSE
      CASE
        WHEN TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 1, 4)) IS NOT NULL
         AND TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 6, 2)) IS NOT NULL
         AND TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 9, 2)) IS NOT NULL
        THEN
          DATEFROMPARTS(
            CASE
              WHEN TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 1, 4)) > 2200
                THEN TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 1, 4)) - 543
              ELSE TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 1, 4))
            END,
            TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 6, 2)),
            TRY_CONVERT(int, SUBSTRING(LEFT(LTRIM(RTRIM(CONVERT(nvarchar(50), ${colExpr}))), 10), 9, 2))
          )
        ELSE NULL
      END
  END
`;

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

    // ✅ stockOutDate (ไทย DD/MM/พ.ศ.) – เทียบ "วันเดียว"
    const stockOutDateTH = req.query.stockOutDate ?? null;
    let stockDateExactStr = null; // 'YYYY-MM-DD' (local)
    if (stockOutDateTH) {
      const d = parseThaiDateToJSDate(stockOutDateTH);
      if (!d || isNaN(d.getTime())) {
        return responseError(
          res,
          "รูปแบบวันที่ stockOutDate ไม่ถูกต้อง (ควรเป็น DD/MM/พ.ศ.)",
          400
        );
      }
      stockDateExactStr = formatJSDateToYMDLocal(d);
    }

    // ช่วงวันที่สำหรับ stockOutDate (ไทย DD/MM/พ.ศ.)
    const stockDateFromTH = req.query.stockDateFromTH
      ? parseThaiDateToJSDate(req.query.stockDateFromTH)
      : null;
    const stockDateToTH = req.query.stockDateToTH
      ? parseThaiDateToJSDate(req.query.stockDateToTH)
      : null;
    const stockFromStr = stockDateFromTH
      ? formatJSDateToYMDLocal(stockDateFromTH)
      : null;
    const stockToStr = stockDateToTH
      ? formatJSDateToYMDLocal(stockDateToTH)
      : null;

    const { col: sortCol, dir: sortDir } = buildOrderBy(
      req.query.sortBy,
      req.query.sortDir
    );
    const offset = (page - 1) * pageSize;

    // -------- where ----------
    const whereParts = [];
    if (status) whereParts.push("d.[status] = @status");

    if (docNo) whereParts.push("UPPER(d.[docNo]) LIKE UPPER(@docNoContains)");
    if (menuId !== null && !Number.isNaN(menuId))
      whereParts.push("d.[menuId] = @menuId");
    if (locationCodeFrom)
      whereParts.push("d.[locationCodeFrom] = @locationCodeFrom");
    if (binCodeFrom) whereParts.push("d.[binCodeFrom] = @binCodeFrom");

    // createdBy ใช้เฉพาะเมื่อไม่ใช่ approver
    if (!isApprover && createdBy) whereParts.push("d.[createdBy] = @createdBy");

    // approver → สนใจเฉพาะ branchCode (หลายค่า, | หรือ ,) + status <> 'Open'
    let branches = [];
    if (isApprover && branchCode) {
      branches = String(branchCode)
        .split(/[|,]/)
        .map((b) => b.trim())
        .filter(Boolean);
      if (branches.length > 0) {
        whereParts.push(
          `(d.[branchCode] IN (${branches
            .map((_, i) => `@br${i}`)
            .join(",")}) AND d.[status] <> 'Open')`
        );
      }
    }

    // ✅ stockOutDate = วันเดียว (normalize BE→AD) เทียบกับ CONVERT(date, @stockDateStr)
    if (stockDateExactStr) {
      whereParts.push(
        `${NORMALIZE_DATE_SQL(
          "d.[stockOutDate]"
        )} = CONVERT(date, @stockDateStr)`
      );
    }

    // ✅ stockOutDate แบบช่วง
    if (stockFromStr) {
      whereParts.push(
        `${NORMALIZE_DATE_SQL(
          "d.[stockOutDate]"
        )} >= CONVERT(date, @stockFromStr)`
      );
    }
    if (stockToStr) {
      whereParts.push(
        `${NORMALIZE_DATE_SQL(
          "d.[stockOutDate]"
        )} <= CONVERT(date, @stockToStr)`
      );
    }

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    // -------- bind ----------
    const listReq = new sql.Request(pool);

    if (status) listReq.input("status", sql.NVarChar(50), status);
    if (docNo) listReq.input("docNoContains", sql.NVarChar(100), `%${docNo}%`);
    if (menuId !== null && !Number.isNaN(menuId))
      listReq.input("menuId", sql.Int, menuId);
    if (locationCodeFrom)
      listReq.input("locationCodeFrom", sql.NVarChar(50), locationCodeFrom);
    if (binCodeFrom)
      listReq.input("binCodeFrom", sql.NVarChar(50), binCodeFrom);

    if (!isApprover && createdBy)
      listReq.input("createdBy", sql.NVarChar(100), createdBy);

    if (isApprover && branches.length > 0) {
      branches.forEach((br, i) =>
        listReq.input(`br${i}`, sql.NVarChar(50), br)
      );
    }

    // ✅ bind เป็นสตริงวันที่ (กัน timezone 100%)
    if (stockDateExactStr)
      listReq.input("stockDateStr", sql.NVarChar(10), stockDateExactStr);
    if (stockFromStr)
      listReq.input("stockFromStr", sql.NVarChar(10), stockFromStr);
    if (stockToStr) listReq.input("stockToStr", sql.NVarChar(10), stockToStr);

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

const GetDocumentByDocNoForTransactionHistory = async (req, res) => {
  const { docNo } = req.params;
  if (!docNo) return responseError(res, "docNo is required", 400);

  // helper: แปลง Date -> "DD/MM/พ.ศ."
  const toThaiDate = (input) => {
    if (!input) return "";
    const d = new Date(input);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const be = d.getFullYear() + 543;
    return `${dd}/${mm}/${be}`;
  };

  try {
    const pool = await poolPromise;

    // ===== Header =====
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
          d.[binCodeTo],
          d.[branchCode]             -- ✅ เพิ่ม branchCode
        FROM [Documents iStock] d
        WHERE d.[docNo] = @docNo
      `);

    if (!hRs.recordset || hRs.recordset.length === 0) {
      return responseError(res, `Document ${docNo} not found`, 404);
    }

    const headerDb = hRs.recordset[0];

    // normalize header เพื่อให้ client ใช้งานร่วมกับ POST payload ได้
    const header = {
      docNo: headerDb.docNo,
      menuId: headerDb.menuId,
      menuName: headerDb.menuName,
      branchCode: headerDb.branchCode ?? "", // ✅ ส่งให้ชัด
      stockOutDate: toThaiDate(headerDb.stockOutDate), // ✅ แปลงเป็น DD/MM/พ.ศ.
      remark: headerDb.remark ?? "",
      locationCodeFrom: headerDb.locationCodeFrom ?? "",
      binCodeFrom: headerDb.binCodeFrom ?? "",
      locationCodeTo: headerDb.locationCodeTo ?? "",
      binCodeTo: headerDb.binCodeTo ?? "",
      createdAt: headerDb.createdAt, // เก็บ ISO ไว้เผื่อหน้า detail ใช้
      createdBy: headerDb.createdBy ?? "",
      status: headerDb.status ?? "Open",
    };

    // ===== Products =====
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
          dp.[picURL]
        FROM [DocumentProducts iStock] dp
        WHERE dp.[docNo] = @docNo
        ORDER BY dp.[id] ASC
      `);

    // ✅ คืนรูปแบบ minimal ตรงสคีมธุรกรรม (ไม่มี details/menuType/id เทียม)
    const products = (pRs.recordset || []).map((item) => ({
      uuid: item.uuid ?? null, // ถ้ามีในตารางก็ส่งให้
      productCode: item.productCode ?? "", // << จำเป็น
      model: item.model ?? "",
      quantity: Number(item.quantity ?? 0), // บังคับ number
      serialNo: item.serialNo ?? "",
      remark: item.remark ?? "",
      picURL: item.picURL ?? "",
    }));

    return responseSuccess(res, "Get document successfully", {
      ...header,
      products,
    });
  } catch (err) {
    console.error("GetDocumentByDocNo error:", err);
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
      docNo: item.productCode,
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

const ApproveDocuments = async (req, res) => {
  const { docNo, status } = req.body;
  if (!docNo) return responseError(res, "docNo is required", 400);
  if (!status) return responseError(res, "status is required", 400);

  const normalizedStatus = String(status).trim();
  const ALLOWED = new Set(["Approved", "Rejected"]);
  if (!ALLOWED.has(normalizedStatus)) {
    return responseError(res, "status must be 'Approved' or 'Rejected'", 400);
  }
  const docNos = String(docNo)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  if (docNos.length === 0) {
    return responseError(res, "No valid docNo provided", 400);
  }
  const placeholders = docNos.map((_, i) => `@doc${i}`).join(", ");
  const orderByCase = docNos.map((_, i) => `WHEN @doc${i} THEN ${i}`).join(" ");
  const CURRENT_STATUS_REQUIRED = "Pending Approval";
  const NEXT_STATUS = normalizedStatus;
  try {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const reqUpdate = new sql.Request(tx);
      docNos.forEach((d, i) => reqUpdate.input(`doc${i}`, sql.VarChar(50), d));
      reqUpdate.input(
        "currentStatus",
        sql.VarChar(50),
        CURRENT_STATUS_REQUIRED
      );
      reqUpdate.input("nextStatus", sql.VarChar(50), NEXT_STATUS);

      const updateSql = `
        ;WITH Target AS (
          SELECT d.*
          FROM [Documents iStock] d
          WHERE d.[docNo] IN (${placeholders})
            AND d.[status] = @currentStatus
        )
        UPDATE Target
           SET [status] = @nextStatus
        OUTPUT inserted.[docNo]  AS docNo,
               deleted.[status]  AS oldStatus,
               inserted.[status] AS newStatus;
      `;
      const uRs = await reqUpdate.query(updateSql);
      const updated = uRs.recordset || [];
      const updatedSet = new Set(updated.map((r) => r.docNo));
      const reqOrder = new sql.Request(tx);
      docNos.forEach((d, i) => reqOrder.input(`doc${i}`, sql.VarChar(50), d));
      const orderedSql = `
        SELECT d.[docNo], d.[status]
        FROM [Documents iStock] d
        WHERE d.[docNo] IN (${placeholders})
        ORDER BY CASE d.[docNo] ${orderByCase} ELSE 999999 END;
      `;
      const orderedRs = await reqOrder.query(orderedSql);
      const currentStatuses = orderedRs.recordset || [];
      const currentMap = new Map(
        currentStatuses.map((r) => [r.docNo, r.status])
      );
      const skipped = docNos
        .filter((d) => !updatedSet.has(d))
        .map((d) => ({
          docNo: d,
          reason: currentMap.has(d)
            ? `Current status is "${currentMap.get(d)}"`
            : "Not Found",
        }));

      await tx.commit();
      return responseSuccess(res, `Updated status to ${NEXT_STATUS}`);
    } catch (err) {
      await tx.rollback();
      return responseError(res, `Failed to update: ${err.message}`, 500);
    }
  } catch (err) {
    return responseError(res, `Database error: ${err.message}`, 500);
  }
};

const SendToApproveDocuments = async (req, res) => {
  const { docNo, user } = req.body;
  if (!docNo) return responseError(res, "docNo is required", 400);
  if (!user) return responseError(res, "user is required", 400);

  const docNos = String(docNo)
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  if (docNos.length === 0) {
    return responseError(res, "No valid docNo provided", 400);
  }

  const placeholders = docNos.map((_, i) => `@doc${i}`).join(", ");
  const orderByCase = docNos.map((_, i) => `WHEN @doc${i} THEN ${i}`).join(" ");
  const CURRENT_STATUS = "Open";
  const NEXT_STATUS = "Pending Approval";

  try {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const reqUpdate = new sql.Request(tx);
      docNos.forEach((d, i) => reqUpdate.input(`doc${i}`, sql.VarChar(50), d));
      reqUpdate.input("currentStatus", sql.VarChar(50), CURRENT_STATUS);
      reqUpdate.input("nextStatus", sql.VarChar(50), NEXT_STATUS);
      reqUpdate.input("user", sql.VarChar(50), user);
      const updateSql = `
        ;WITH Target AS (
          SELECT d.*
          FROM [Documents iStock] d
          WHERE d.[docNo] IN (${placeholders})
            AND d.[status] = @currentStatus
            AND d.[createdBy] = @user
        )
        UPDATE Target
           SET [status] = @nextStatus
        OUTPUT inserted.[docNo]  AS docNo,
               deleted.[status]  AS oldStatus,
               inserted.[status] AS newStatus;
      `;
      const uRs = await reqUpdate.query(updateSql);
      const updated = uRs.recordset || [];
      const updatedSet = new Set(updated.map((r) => r.docNo));
      const reqOrder = new sql.Request(tx);
      docNos.forEach((d, i) => reqOrder.input(`doc${i}`, sql.VarChar(50), d));
      const orderedSql = `
        SELECT d.[docNo], d.[status], d.[createdBy]
        FROM [Documents iStock] d
        WHERE d.[docNo] IN (${placeholders})
        ORDER BY CASE d.[docNo] ${orderByCase} ELSE 999999 END;
      `;
      const orderedRs = await reqOrder.query(orderedSql);
      const currentStatuses = orderedRs.recordset || [];
      const currentMap = new Map(currentStatuses.map((r) => [r.docNo, r]));
      const skipped = docNos
        .filter((d) => !updatedSet.has(d))
        .map((d) => {
          const info = currentMap.get(d);
          return {
            docNo: d,
            reason: info
              ? info.createdBy !== user
                ? `createdBy mismatch (expected ${user}, found ${info.createdBy})`
                : `Current status is "${info.status}"`
              : "Not Found",
          };
        });

      await tx.commit();
      return responseSuccess(res, `Updated status to ${NEXT_STATUS}`);
    } catch (err) {
      await tx.rollback();
      return responseError(res, `Failed to update: ${err.message}`, 500);
    }
  } catch (err) {
    return responseError(res, `Database error: ${err.message}`, 500);
  }
};

module.exports = {
  GetDocuments,
  GetDocumentByDocNo,
  GetDocumentProductsByDocNo,
  GetDocumentsByDocNos,
  ApproveDocuments,
  SendToApproveDocuments,
  GetDocumentByDocNoForTransactionHistory,
};
