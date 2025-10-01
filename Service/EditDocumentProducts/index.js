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
 *          "quantity": 10,        // number (ไม่ส่งมา = ไม่อัพเดต)
 *          "serialNo": "SN001",   // string | null (ไม่ส่งมา = ไม่อัพเดต)
 *          "remark": "หมายเหตุ"   // string | null (ไม่ส่งมา = ไม่อัพเดต)
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

    // อนุญาตแก้เฉพาะ 3 ฟิลด์นี้
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

    // กรอง patch: "ไม่ส่งมา/undefined => ไม่อัพเดต", "null => อัพเดตเป็น NULL"
    const sanitizedItems = items.map((it) => {
      const clean = {};
      for (const k of Object.keys(it.patch)) {
        if (!allowedFields.has(k)) continue;

        const v = it.patch[k];

        // ❗ ไม่อัพเดตถ้า undefined (เท่ากับ "ไม่ได้ส่งมา")
        if (typeof v === "undefined") continue;

        if (k === "quantity") {
          if (v === null) {
            clean.quantity = null;
          } else if (typeof v === "number" && isFinite(v)) {
            clean.quantity = v;
          } else {
            return { __error: `quantity must be a number or null`, it };
          }
        } else if (k === "serialNo" || k === "remark") {
          if (v === null) {
            clean[k] = null;
          } else if (typeof v === "string") {
            clean[k] = v.trim();
          } else {
            return { __error: `${k} must be a string or null`, it };
          }
        }
      }
      return {
        uuid: it.uuid,
        productCode: it.productCode,
        patch: clean,
      };
    });

    // ตรวจ error จากขั้น sanitize
    const sanitizeErr = sanitizedItems.find((s) => s?.__error);
    if (sanitizeErr) {
      return responseError(res, sanitizeErr.__error, 400);
    }

    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      let updated = 0;
      const updatedItems = [];
      const notFound = [];
      const skipped = []; // ไม่มีฟิลด์ที่จะอัพเดต (เพราะไม่ได้ส่งมา/ไม่อยู่ใน allowed)

      const bindValue = (request, name, value) => {
        if (value === null) {
          request.input(name, sql.Variant, null);
          return;
        }
        if (typeof value === "number") {
          // ถ้าต้องการบังคับ INT เสมอ: เปลี่ยนเป็น sql.Int
          if (Number.isInteger(value)) {
            request.input(name, sql.Int, value);
          } else {
            request.input(name, sql.Decimal(18, 6), value);
          }
        } else if (typeof value === "string") {
          request.input(name, sql.NVarChar(sql.MAX), value);
        } else {
          // fallback
          request.input(name, sql.NVarChar(sql.MAX), String(value));
        }
      };

      for (const { uuid, productCode, patch } of sanitizedItems) {
        const keys = Object.keys(patch);
        if (keys.length === 0) {
          skipped.push({
            uuid,
            productCode,
            reason: "No fields provided to update",
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
