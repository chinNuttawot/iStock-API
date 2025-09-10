// controllers/transactionHistory.controller.js
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { formatDate, formatDateTime, getMenuType } = require("../Card");

const dateLabelByMenuId = (menuId) => {
  if (menuId === 0) return "วันที่ส่งสินค้า";
  if (menuId === 1) return "วันที่ตัดสินค้า";
  if (menuId === 2) return "วันที่โอนย้าย";
  if (menuId === 3) return "วันที่ตรวจนับ";
};

function transformDocuments(rows = []) {
  return rows.map((item, idx) => {
    const product = Array.isArray(item.product) ? item.product : [];

    return {
      id: String(idx + 1),
      docNo: item?.docNo ?? "",
      menuType: getMenuType(item?.menuId),
      menuId: item?.menuId ?? null,
      branchCode: item?.branchCode ?? "",
      status: item?.status ?? "",
      date: `สร้างวันที่ ${formatDateTime(item?.createdAt)}`,
      product: product.map((item2, idx) => ({
        id: String(idx + 1),
        docNo: item2.productCode,
        menuType: getMenuType(item.menuId),
        menuId: item2.menuId,
        model: item2.model,
        uuid: item2.uuid,
        picURL: item2.picURL,
        details: [
          { label: "จำนวน", value: item2.quantity },
          { label: "รหัสแบบ", value: item2.model },
          { label: "serial No.", value: item2.serialNo },
          { label: "หมายเหตุ", value: item2.remark || "-" },
        ],
      })),
      details: [
        {
          label: dateLabelByMenuId(item?.menuId),
          value: formatDate(item?.stockOutDate),
        },
        ...(item?.menuId !== 2
          ? [
              { label: "คลังหลัก", value: `${item?.locationCodeFrom ?? ""}` },
              { label: "คลังย่อย", value: `${item?.binCodeFrom ?? ""}` },
            ]
          : [
              {
                label: "คลังหลัก (ต้นทาง)",
                value: `${item?.locationCodeFrom ?? ""}`,
              },
              {
                label: "คลังย่อย (ต้นทาง)",
                value: `${item?.binCodeFrom ?? ""}`,
              },
              {
                label: "คลังหลัก (ปลายทาง)",
                value: `${item?.locationCodeTo ?? ""}`,
              },
              {
                label: "คลังย่อย (ปลายทาง)",
                value: `${item?.binCodeTo ?? ""}`,
              },
            ]),
        { label: "หมายเหตุ", value: item?.remark || "-" },
      ],
    };
  });
}

/** helper: clamp string length */
const clamp = (s, n) => (s == null ? s : String(s).slice(0, n));

/** helper: parse 'DD/MM/YYYY' (พ.ศ./ค.ศ.) -> JS Date at 00:00:00 (local) */
function parseThaiDateOnly(input) {
  if (!input || typeof input !== "string" || !input.includes("/")) return null;
  const [dd, mm, yyyyRaw] = input.split("/").map((v) => parseInt(v, 10));
  if (!dd || !mm || !yyyyRaw) return null;
  const year = yyyyRaw > 2400 ? yyyyRaw - 543 : yyyyRaw; // พ.ศ. -> ค.ศ.
  return new Date(year, mm - 1, dd, 0, 0, 0, 0);
}

/** helper: parse 'DD/MM/YYYY' (พ.ศ.) หรือ ISO -> JS Date (ใช้กับ stockOutDate ตอน insert) */
function parseThaiDateToJSDate(input) {
  if (!input) return null;
  if (typeof input === "string" && input.includes("/")) {
    const [dd, mm, yyyyThai] = input.split("/").map((v) => parseInt(v, 10));
    if (!dd || !mm || !yyyyThai) return null;
    const yyyy = yyyyThai > 2400 ? yyyyThai - 543 : yyyyThai;
    return new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** POST /api/transaction-history : create 1 record */
const CreateTransactionHistory = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      docNo,
      menuId,
      menuName,
      stockOutDate, // รับได้ทั้ง DD/MM/พ.ศ. หรือ ISO string/Date
      remark,
      locationCodeFrom,
      binCodeFrom,
      locationCodeTo,
      binCodeTo,
      branchCode,
      status,
      createdAt, // ถ้าไม่ส่ง จะ default = now
      createdBy,
      products = [], // จะถูก JSON.stringify เก็บในคอลัมน์ [product]
    } = body;

    if (!docNo) return responseError(res, "docNo is required", 400);
    if (!branchCode) return responseError(res, "branchCode is required", 400);

    const stockOutDateJS = parseThaiDateToJSDate(stockOutDate);
    const createdAtJS = createdAt ? new Date(createdAt) : new Date();

    let productJson = "[]";
    try {
      productJson = JSON.stringify(products ?? []);
    } catch {
      productJson = "[]";
    }

    const pool = await poolPromise;
    await pool
      .request()
      .input("docNo", sql.NVarChar(50), clamp(docNo, 50))
      .input("menuId", sql.Int, menuId ?? null)
      .input("menuName", sql.NVarChar(200), clamp(menuName, 200))
      .input("stockOutDate", sql.DateTime, stockOutDateJS ?? null)
      .input("remark", sql.NVarChar(500), clamp(remark, 500))
      .input("locationCodeFrom", sql.NVarChar(50), clamp(locationCodeFrom, 50))
      .input("binCodeFrom", sql.NVarChar(50), clamp(binCodeFrom, 50))
      .input("locationCodeTo", sql.NVarChar(50), clamp(locationCodeTo, 50))
      .input("binCodeTo", sql.NVarChar(50), clamp(binCodeTo, 50))
      .input("branchCode", sql.NVarChar(10), clamp(branchCode, 10))
      .input("status", sql.NVarChar(50), clamp(status, 50))
      .input("createdAt", sql.DateTime2, createdAtJS)
      .input("createdBy", sql.NVarChar(100), clamp(createdBy, 100))
      .input("product", sql.NVarChar(sql.MAX), productJson).query(`
        INSERT INTO [TransactionHistory iStock]
          (docNo, menuId, menuName, stockOutDate, remark,
           locationCodeFrom, binCodeFrom, locationCodeTo, binCodeTo,
           branchCode, status, createdAt, createdBy, product)
        VALUES
          (@docNo, @menuId, @menuName, @stockOutDate, @remark,
           @locationCodeFrom, @binCodeFrom, @locationCodeTo, @binCodeTo,
           @branchCode, @status, @createdAt, @createdBy, @product)
      `);

    return responseSuccess(res, "Save transaction history successfully", {
      docNo,
      branchCode,
    });
  } catch (err) {
    console.error("CreateTransactionHistory error:", err);
    if (!res.headersSent) {
      return responseError(res, "Failed to save transaction history", 500);
    }
  }
};

/**
 * GET /api/transaction-history
 * Query params:
 *   - createdBy    (required)
 *   - docNo        (optional, partial)
 *   - branchCode   (optional)
 *   - status       (optional)
 *   - dateFrom     (optional, ISO; filter createdAt >= dateFrom)
 *   - dateTo       (optional, ISO;  filter createdAt <  dateTo)
 *   - stockOutDate (optional, DD/MM/YYYY พ.ศ./ค.ศ.; เทียบวันเดียว)
 *   - sortBy       (optional: createdAt|docNo|stockOutDate; default createdAt)
 *   - sortDir      (optional: ASC|DESC; default DESC)
 */
const GetTransactionHistory = async (req, res) => {
  try {
    const {
      createdBy,
      docNo,
      branchCode,
      status,
      dateFrom,
      dateTo,
      stockOutDate, // DD/MM/YYYY
      sortBy = "createdAt",
      sortDir = "DESC",
    } = req.query || {};

    if (!createdBy) {
      return responseError(res, "createdBy is required", 400);
    }

    // allow-list sort
    const sortCol = ["createdAt", "docNo", "stockOutDate"].includes(
      String(sortBy)
    )
      ? sortBy
      : "createdAt";
    const sortDirection =
      String(sortDir).toUpperCase() === "ASC" ? "ASC" : "DESC";

    // WHERE builder
    const whereParts = ["[createdBy] = @createdBy"];
    if (docNo) whereParts.push("UPPER([docNo]) LIKE UPPER(@docNo)");
    if (branchCode) whereParts.push("[branchCode] = @branchCode");
    if (status) whereParts.push("[status] = @status");
    if (dateFrom) whereParts.push("[createdAt] >= @dateFrom");
    if (dateTo) whereParts.push("[createdAt] <  @dateTo");

    // ใช้ DATEFROMPARTS เพื่อเทียบ 'วันเดียว' ของ stockOutDate โดยไม่โดน timezone
    // ตัวแปร @y, @m, @d จะถูก bind เฉพาะเมื่อ client ส่ง stockOutDate มา
    if (stockOutDate) {
      whereParts.push(
        "CAST([stockOutDate] AS DATE) = DATEFROMPARTS(@y, @m, @d)"
      );
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

    // bind params
    const pool = await poolPromise;
    const request = pool
      .request()
      .input("createdBy", sql.NVarChar(100), createdBy);

    if (docNo) request.input("docNo", sql.NVarChar(50), `%${docNo}%`);
    if (branchCode) request.input("branchCode", sql.NVarChar(10), branchCode);
    if (status) request.input("status", sql.NVarChar(50), status);

    if (dateFrom) {
      const dFrom = new Date(dateFrom);
      if (!isNaN(dFrom)) request.input("dateFrom", sql.DateTime2, dFrom);
    }
    if (dateTo) {
      const dTo = new Date(dateTo);
      if (!isNaN(dTo)) request.input("dateTo", sql.DateTime2, dTo);
    }

    if (stockOutDate) {
      // แปลง 'DD/MM/YYYY' (รองรับ พ.ศ.) → year,month,day (ค.ศ.)
      const d = parseThaiDateOnly(stockOutDate);
      if (d) {
        request.input("y", sql.Int, d.getFullYear());
        request.input("m", sql.Int, d.getMonth() + 1);
        request.input("d", sql.Int, d.getDate());
      }
    }

    const sqlQuery = `
      SELECT
        [id],
        [docNo],
        [menuId],
        [menuName],
        [stockOutDate],
        [remark],
        [locationCodeFrom],
        [binCodeFrom],
        [locationCodeTo],
        [binCodeTo],
        [branchCode],
        [product],
        [status],
        [createdAt],
        [createdBy]
      FROM [dbo].[TransactionHistory iStock]
      ${whereSql}
      ORDER BY ${sortCol} ${sortDirection};
    `;

    const result = await request.query(sqlQuery);

    // parse product JSON ก่อนส่ง
    const rows = result.recordset.map((row) => {
      let parsedProduct = [];
      try {
        parsedProduct = row.product ? JSON.parse(row.product) : [];
      } catch {
        parsedProduct = [];
      }
      return { ...row, product: parsedProduct };
    });

    return responseSuccess(
      res,
      "Get transaction history success",
      transformDocuments(rows)
    );
  } catch (err) {
    console.error("GetTransactionHistory error:", err);
    if (!res.headersSent) {
      return responseError(res, "Failed to get transaction history", 500);
    }
  }
};

module.exports = { CreateTransactionHistory, GetTransactionHistory };
