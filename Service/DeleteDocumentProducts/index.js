// src/controllers/DocumentProducts/DeleteDocumentProductsBatch.js
const { poolPromise, sql } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

/**
 * POST /document-products/delete-batch
 * Body:
 * {
 *   "items": [
 *     {"uuid":"...", "docNo":"..."},
 *     {"uuid":"...", "docNo":"..."}
 *   ]
 * }
 */
const DeleteDocumentProducts = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items || items.length === 0) {
      return responseError(res, "items (array) is required", 400);
    }

    // ตรวจรูปแบบข้อมูล
    const bad = items.find(
      (x) =>
        !x ||
        typeof x.uuid !== "string" ||
        typeof x.docNo !== "string" ||
        !x.docNo ||
        !x.uuid
    );
    if (bad) {
      return responseError(
        res,
        "Each item must be an object with string fields: { uuid, docNo }",
        400
      );
    }

    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();

    const jsonText = JSON.stringify(items);
    const request = new sql.Request(tx);
    request.input("jsonItems", sql.NVarChar(sql.MAX), jsonText);

    try {
      // วิธีหลัก: ใช้ OPENJSON ลบทีเดียว (ต้องการ SQL Server 2016+ / compatibility level >= 130)
      const result = await request.query(`
        WITH pairs AS (
          SELECT j.uuid, j.docNo
          FROM OPENJSON(@jsonItems)
          WITH (
            uuid NVARCHAR(64) '$.uuid',
            docNo NVARCHAR(64) '$.docNo'
          ) j
        )
        DELETE dp
        OUTPUT DELETED.uuid AS uuid, DELETED.docNo AS docNo
        FROM [DocumentProducts iStock] AS dp
        INNER JOIN pairs p
          ON p.uuid = dp.[uuid]
         AND p.docNo = dp.[docNo];
      `);

      await tx.commit();

      const deleted = result?.recordset || [];
      const key = new Set(deleted.map((r) => `${r.uuid}||${r.docNo}`));
      const notFound = items.filter((x) => !key.has(`${x.uuid}||${x.docNo}`));

      return responseSuccess(res, "Deleted successfully", {
        requested: items.length,
        deleted: deleted.length,
        deletedItems: deleted,
        notFound,
      });
    } catch (err) {
      // ถ้า OPENJSON ใช้ไม่ได้ ให้ fallback เป็นลูปทีละตัวใน Transaction เดิม
      // (เช่น compatibility level ต่ำกว่า 130)
      // console.warn("OPENJSON not available, fallback loop:", err);
      try {
        let deleted = 0;
        const deletedItems = [];
        const notFound = [];

        for (const { uuid, docNo } of items) {
          const r = new sql.Request(tx);
          r.input("uuid", sql.NVarChar(64), uuid);
          r.input("docNo", sql.NVarChar(64), docNo);
          const q = await r.query(`
            DELETE FROM [DocumentProducts iStock]
            WHERE [uuid] = @uuid AND [docNo] = @docNo;
            SELECT @@ROWCOUNT AS affected;
          `);
          const affected = q?.recordset?.[0]?.affected || 0;
          if (affected > 0) {
            deleted += affected;
            deletedItems.push({ uuid, docNo });
          } else {
            notFound.push({ uuid, docNo });
          }
        }

        await tx.commit();
        return responseSuccess(res, "Deleted successfully (fallback)", {
          requested: items.length,
          deleted,
          deletedItems,
          notFound,
        });
      } catch (fallbackErr) {
        await tx.rollback();
        return responseError(
          res,
          "Failed to delete (fallback)",
          String(fallbackErr),
          500
        );
      }
    }
  } catch (error) {
    return responseError(res, "Failed to delete", String(error), 500);
  }
};

module.exports = {
  DeleteDocumentProducts,
};
