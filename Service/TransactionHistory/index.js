// controllers/transactionHistory.controller.js
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { formatDate, formatDateTime, getMenuType } = require("../Card");

/** ================= Helpers ================= */

/** ป้ายวันที่ตามเมนู */
const dateLabelByMenuId = (menuId) => {
  if (menuId === 0) return "วันที่ส่งสินค้า";
  if (menuId === 1) return "วันที่ตัดสินค้า";
  if (menuId === 2) return "วันที่โอนย้าย";
  if (menuId === 3) return "วันที่ตรวจนับ";
  return "วันที่เอกสาร";
};

/** จำกัดความยาวสตริง */
const clamp = (s, n) => (s == null ? s : String(s).slice(0, n));

/** parse 'DD/MM/YYYY' (พ.ศ./ค.ศ.) -> JS Date */
function parseThaiDateOnly(input) {
  if (!input || typeof input !== "string" || !input.includes("/")) return null;
  const m = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  let [, dd, MM, yyyyRaw] = m;
  let day = parseInt(dd, 10);
  let mon = parseInt(MM, 10);
  let year = parseInt(yyyyRaw, 10);
  if (!day || !mon || !year) return null;
  if (year > 2400) year -= 543; // BE -> AD
  return new Date(year, mon - 1, day, 0, 0, 0, 0);
}

/** normalize input date (string, Date, ISO) */
function normalizeInputDate(input) {
  if (!input) return null;
  if (input instanceof Date && !isNaN(input.getTime())) return input;
  if (typeof input === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return parseThaiDateOnly(input);
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) {
      const d = new Date(input);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** แปลง rows -> โครงสร้างการ์ดที่ mobile ใช้ */
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
      product: product.map((item2, idx2) => ({
        id: String(idx2 + 1),
        docNo: item2.productCode,
        menuType: getMenuType(item.menuId),
        menuId: item2.menuId,
        model: item2.model,
        uuid: item2.uuid,
        picURL: item2.picURL,
        description: item2.description || "", // ✅ เพิ่ม description
        details: [
          {
            label: "ชื่อสินค้า",
            value: (item2.description || "").trim() || "ไม่มีชื่อสินค้า",
          },
          { label: "รหัสแบบ", value: item2.model },
          { label: "จำนวน", value: item2.quantity },
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

/** ================= Controllers ================= */

/** POST /api/transaction-history : create 1 record */
const CreateTransactionHistory = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      docNo,
      menuId,
      menuName,
      stockOutDate,
      remark,
      locationCodeFrom,
      binCodeFrom,
      locationCodeTo,
      binCodeTo,
      branchCode,
      status,
      createdBy,
      products = [],
    } = body;

    if (!docNo) return responseError(res, "docNo is required", 400);
    if (!branchCode) return responseError(res, "branchCode is required", 400);

    const stockOutDateJS = normalizeInputDate(stockOutDate);
    if (stockOutDate && !stockOutDateJS) {
      return responseError(
        res,
        "stockOutDate format invalid (รองรับ DD/MM/YYYY หรือ ISO)",
        400
      );
    }

    const createdAtJS = new Date();

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
      .input(
        "stockOutDate",
        stockOutDateJS ? sql.DateTime2 : sql.DateTime2,
        stockOutDateJS ?? null
      )
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

/** GET /api/transaction-history */
const GetTransactionHistory = async (req, res) => {
  try {
    const {
      createdBy,
      docNo,
      branchCode,
      status,
      dateFrom,
      dateTo,
      stockOutDate,
      sortBy = "createdAt",
      sortDir = "DESC",
    } = req.query || {};

    if (!createdBy) {
      return responseError(res, "createdBy is required", 400);
    }

    const sortCol = ["createdAt", "docNo", "stockOutDate"].includes(
      String(sortBy)
    )
      ? sortBy
      : "createdAt";
    const sortDirection =
      String(sortDir).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const whereParts = ["[createdBy] = @createdBy"];
    if (docNo) whereParts.push("UPPER([docNo]) LIKE UPPER(@docNo)");
    if (branchCode) whereParts.push("[branchCode] = @branchCode");
    if (status) whereParts.push("[status] = @status");
    if (dateFrom) whereParts.push("[createdAt] >= @dateFrom");
    if (dateTo) whereParts.push("[createdAt] <  @dateTo");

    if (stockOutDate) {
      whereParts.push(
        "CAST(SWITCHOFFSET([stockOutDate] AT TIME ZONE 'UTC', '+07:00') AS DATE) = DATEFROMPARTS(@y, @m, @d)"
      );
    }

    const whereSql = `WHERE ${whereParts.join(" AND ")}`;

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
