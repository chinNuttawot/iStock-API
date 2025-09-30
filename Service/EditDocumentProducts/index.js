// src/controllers/DocumentProducts/EditDocumentProductsBatch.js
const { poolPromise, sql } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

/**
 * POST /document-products-edit
 * Body:
 * {
 *   "items": [
 *     {
 *       "uuid": "....",
 *       "productCode": "....",
 *       "patch": {
 *          "quantity": 10,        // (number/int)
 *          "serialNo": "SN001",   // (string)
 *          "remark": "หมายเหตุ"   // (string)
 *       }
 *     }
 *   ]
 * }
 */
const EditDocumentProducts = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items || items.length === 0) {
      return responseError(res, "items (array) is required", 400);
    }

    // ====== อนุญาตแก้เฉพาะ 3 ฟิลด์นี้ ======
    const allowedFields = new Set(["quantity", "serialNo", "remark"]);

    // ตรวจรูปแบบข้อมูลพื้นฐาน
    const bad = items.find(
      (x) =>
        !x ||
        typeof x.uuid !== "string" ||
        !x.uuid ||
        typeof x.productCode !== "string" ||
        !x.productCode ||
        typeof x.patch !== "object" ||
        x.patch === null
    );
    if (bad) {
      return responseError(
        res,
        "Each item must be { uuid: string, productCode: string, patch: object }",
        400
      );
    }

    // กรอง patch และทำความสะอาดค่า (trim string / ตรวจ type)
    const sanitizedItems = [];
    for (const it of items) {
      const clean = {};
      for (const [k, v] of Object.entries(it.patch)) {
        if (!allowedFields.has(k)) continue;

        if (k === "quantity") {
          // อนุญาต number เท่านั้น (int หรือ decimal ก็ได้ แต่จะ bind เป็น INT ถ้าเป็นจำนวนเต็ม)
          if (typeof v !== "number" || !isFinite(v)) {
            return responseError(res, `quantity must be a number`, 400);
          }
          clean.quantity = v;
        } else if (k === "serialNo" || k === "remark") {
          if (v === null || v === undefined) {
            clean[k] = null;
          } else if (typeof v === "string") {
            clean[k] = v.trim();
          } else {
            return responseError(res, `${k} must be a string or null`, 400);
          }
        }
      }
      sanitizedItems.push({
        uuid: it.uuid,
        productCode: it.productCode,
        patch: clean,
      });
    }

    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      let updated = 0;
      const updatedItems = [];
      const notFound = [];
      const skipped = [];

      const bindValue = (request, name, value) => {
        if (value === null || value === undefined) {
          request.input(name, sql.Variant, null);
          return;
        }
        if (typeof value === "number") {
          if (Number.isInteger(value)) {
            request.input(name, sql.Int, value);
          } else {
            request.input(name, sql.Decimal(18, 6), value);
          }
        } else if (typeof value === "string") {
          request.input(name, sql.NVarChar(sql.MAX), value);
        } else {
          request.input(name, sql.NVarChar(sql.MAX), String(value));
        }
      };

      for (const { uuid, productCode, patch } of sanitizedItems) {
        const keys = Object.keys(patch);
        if (keys.length === 0) {
          skipped.push({
            uuid,
            productCode,
            reason: "No allowed fields in patch",
          });
          continue;
        }

        const r = new sql.Request(tx);
        r.input("uuid", sql.NVarChar(64), uuid);
        r.input("productCode", sql.NVarChar(64), productCode);

        const setFragments = [];
        keys.forEach((k, idx) => {
          const pName = `p_${idx}`;
          setFragments.push(`[${k}] = @${pName}`);
          bindValue(r, pName, patch[k]);
        });

        const q = await r.query(`
          UPDATE [DocumentProducts iStock]
             SET ${setFragments.join(", ")}
           WHERE [uuid] = @uuid AND [productCode] = @productCode;

          SELECT @@ROWCOUNT AS affected;
        `);

        const affected = q?.recordset?.[0]?.affected || 0;
        if (affected > 0) {
          updated += affected;
          updatedItems.push({ uuid, productCode, patch });
        } else {
          notFound.push({ uuid, productCode });
        }
      }

      await tx.commit();
      return responseSuccess(res, "Edited successfully", {
        requested: items.length,
        updated,
        updatedItems,
        notFound,
        skipped,
      });
    } catch (err) {
      await tx.rollback();
      return responseError(res, "Failed to edit", String(err), 500);
    }
  } catch (error) {
    return responseError(res, "Failed to edit", String(error), 500);
  }
};

module.exports = {
  EditDocumentProducts,
};
