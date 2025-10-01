// src/controllers/DocumentProducts/AddDocumentProducts.js
const { sql, poolPromise } = require("../../config/db");
const { randomUUID } = require("crypto");
const { responseSuccess, responseError } = require("../../utils/responseHelper");

/** แปลงจำนวนให้เป็นตัวเลข (รองรับ "1,234.56" หรือ number) */
function toNumber(val, fallback = 0) {
  if (typeof val === "number") return isFinite(val) ? val : fallback;
  if (val == null) return fallback;
  const n = Number(String(val).replace(/,/g, "").trim());
  return isNaN(n) ? fallback : n;
}

/** ตรวจ uuid v{1-5} แบบหลวม */
function isUuid(str) {
  if (typeof str !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str.trim()
  );
}

/**
 * POST /document-products/add
 * Body:
 * {
 *   "docNo": "MO-250928-9195",
 *   "branchCode": "BKK-01",
 *   "products": [
 *     {
 *       "productCode": "3ISP00322",
 *       "model": "VR000",
 *       "quantity": "0",
 *       "serialNo": "",
 *       "remark": "",
 *       "uuid": "89c0ebe0-891a-45ae-9ff6-afe3b7b4ff93",
 *       "picURL": "https://..."
 *     }
 *   ]
 * }
 */
const addDocumentProducts = async (req, res) => {
  const { docNo, branchCode, products } = req.body || {};

  // ตรวจ input ระดับบน
  if (!docNo) {
    return responseError(res, "docNo is required", 400);
  }
  if (!Array.isArray(products) || products.length === 0) {
    return responseError(res, "products must be a non-empty array", 400);
  }

  // ตรวจและทำความสะอาดข้อมูลรายแถวก่อนเริ่ม transaction
  const cleanItems = [];
  const preErrors = [];
  products.forEach((raw, idx) => {
    const item = raw || {};
    const productCode = (item.productCode ?? "").toString().trim();
    const model = item.model ?? null;
    const quantity = toNumber(item.quantity, 0);
    const serialNo = (item.serialNo ?? null) || null;
    const remark = (item.remark ?? null) || null;
    const picURL = (item.picURL ?? null) || null;
    const ensuredUuid = isUuid(item.uuid) ? item.uuid : randomUUID();

    if (!productCode) {
      preErrors.push({ index: idx, message: "productCode is required" });
      return;
    }

    cleanItems.push({
      productCode,
      model,
      quantity,
      serialNo,
      remark,
      branchCode: branchCode || null,
      picURL,
      uuid: ensuredUuid,
    });
  });

  if (cleanItems.length === 0) {
    return responseError(res, "No valid rows to insert", 400, { preErrors });
  }

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    let inserted = 0;
    const itemErrors = [];

    for (let i = 0; i < cleanItems.length; i++) {
      const p = cleanItems[i];

      try {
        const rq = new sql.Request(tx);
        await rq
          .input("docNo", sql.VarChar(50), docNo)
          .input("uuid", sql.UniqueIdentifier, p.uuid)
          .input("productCode", sql.NVarChar(100), p.productCode)
          .input("model", sql.NVarChar(100), p.model)
          .input("quantity", sql.Decimal(18, 2), p.quantity)
          .input("serialNo", sql.NVarChar(100), p.serialNo)
          .input("remark", sql.NVarChar(255), p.remark)
          .input("branchCode", sql.NVarChar(50), p.branchCode)
          .input("picURL", sql.NVarChar(250), p.picURL).query(`
            INSERT INTO [DocumentProducts iStock]
              (docNo, uuid, productCode, model, quantity, serialNo, remark, branchCode, picURL)
            VALUES
              (@docNo, @uuid, @productCode, @model, @quantity, @serialNo, @remark, @branchCode, @picURL)
          `);
        inserted++;
      } catch (err) {
        itemErrors.push({
          index: i,
          productCode: p.productCode,
          model: p.model,
          message: err?.number
            ? `SQL(${err.number}): ${err.message}`
            : err?.message || String(err),
        });
        // ถ้าต้องการ rollback ทั้งก้อนเมื่อมีแถวใดแถวหนึ่งผิดพลาด:
        // throw err;
      }
    }

    if (inserted === 0) {
      await tx.rollback();
      return responseError(res, "No rows inserted", 400, {
        preErrors,
        itemErrors,
      });
    }

    await tx.commit();
    return responseSuccess(res, "Inserted document products", {
      requested: products.length,
      valid: cleanItems.length,
      inserted,
      preErrors,   // แถวที่ตกตั้งแต่ก่อนยิง SQL (เช่น productCode ว่าง)
      itemErrors,  // แถวที่ error ตอนยิง SQL
    });
  } catch (err) {
    try { await tx.rollback(); } catch (_) {}
    return responseError(
      res,
      "Insert failed",
      500,
      { error: err?.message || String(err) }
    );
  }
};

module.exports = { addDocumentProducts };
