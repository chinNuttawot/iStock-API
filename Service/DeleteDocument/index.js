const path = require("path");
const { sql, poolPromise, config } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { safeUnlink, safeJoin } = require("../../utils/fsx");

function toBasenameFromUrl(u) {
  try {
    if (!u || typeof u !== "string") return null;
    // รองรับทั้ง URL แบบ http(s)://.../file.ext และ path ภายใน
    const decoded = decodeURIComponent(u);
    return path.basename(decoded);
  } catch {
    return null;
  }
}

/**
 * DELETE /documents/:docNo
 * หรือเรียกผ่าน service/controller ได้เหมือนกัน
 * ขั้นตอน:
 * 1) ตรวจว่ามีหัวเอกสารหรือไม่
 * 2) ดึงรายการรูปใน [Image iStock] (เก็บ basename ไว้ไปลบไฟล์จริง "หลัง" commit)
 * 3) ลบรายการลูก: [DocumentProducts iStock]
 * 4) ลบรายการรูป: [Image iStock]
 * 5) ลบหัวเอกสาร: [Documents iStock]
 * 6) commit แล้วค่อยลบไฟล์จริงด้วย safeUnlink (อยู่นอกทรานแซ็กชัน)
 */
async function deleteDocumentByDocNo(req, res) {
  const docNo = (req.params.docNo || req.body.docNo || "").trim();

  if (!docNo) {
    return responseError(res, "กรุณาระบุ docNo", 400);
  }

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  // เก็บไฟล์ที่จะลบ (basename) ไว้ลบหลัง commit
  let imageFiles = [];

  try {
    await tx.begin();

    // 1) ตรวจว่ามีเอกสารหรือไม่
    const checkReq = new sql.Request(tx);
    checkReq.input("docNo", sql.NVarChar(100), docNo);
    const checkRs = await checkReq.query(`
      SELECT TOP 1 [docNo]
      FROM [dbo].[Documents iStock]
      WHERE [docNo] = @docNo
    `);

    if (!checkRs.recordset || checkRs.recordset.length === 0) {
      await tx.rollback();
      return responseError(res, `ไม่พบเอกสาร docNo: ${docNo}`, 404);
    }

    // 2) รูปทั้งหมดของเอกสารนี้ (ไว้ลบไฟล์จริงหลัง commit)
    const imgReq = new sql.Request(tx);
    imgReq.input("docNo", sql.NVarChar(100), docNo);
    const imgRs = await imgReq.query(`
      SELECT [id], [picURL]
      FROM [dbo].[Image iStock]
      WHERE [keyRef1] = @docNo
    `);
    imageFiles = (imgRs.recordset || [])
      .map((r) => toBasenameFromUrl(r.picURL))
      .filter(Boolean);

    // 3) ลบลูก: DocumentProducts
    const delProdReq = new sql.Request(tx);
    delProdReq.input("docNo", sql.NVarChar(100), docNo);
    const delProd = await delProdReq.query(`
      DELETE FROM [dbo].[DocumentProducts iStock]
      WHERE [docNo] = @docNo
    `);
    const deletedProducts = Array.isArray(delProd.rowsAffected)
      ? delProd.rowsAffected.reduce((a, b) => a + b, 0)
      : 0;

    // 4) ลบรูป: Image iStock
    const delImgReq = new sql.Request(tx);
    delImgReq.input("docNo", sql.NVarChar(100), docNo);
    const delImg = await delImgReq.query(`
      DELETE FROM [dbo].[Image iStock]
      WHERE [keyRef1] = @docNo
    `);
    const deletedImages = Array.isArray(delImg.rowsAffected)
      ? delImg.rowsAffected.reduce((a, b) => a + b, 0)
      : 0;

    // 5) ลบหัวเอกสาร
    const delDocReq = new sql.Request(tx);
    delDocReq.input("docNo", sql.NVarChar(100), docNo);
    const delDoc = await delDocReq.query(`
      DELETE FROM [dbo].[Documents iStock]
      WHERE [docNo] = @docNo
    `);
    const deletedDocs = Array.isArray(delDoc.rowsAffected)
      ? delDoc.rowsAffected.reduce((a, b) => a + b, 0)
      : 0;

    await tx.commit();

    // 6) ลบไฟล์จริงหลัง commit (หากใช้งานโฟลเดอร์อัปโหลดในเครื่อง)
    // หมายเหตุ: ถ้า picURL เป็น external storage/CDN อาจไม่ต้องลบไฟล์ที่นี่
    const fileResults = [];
    for (const basename of imageFiles) {
      // ป้องกัน traversal ด้วย safeJoin
      const target = safeJoin(config.UPLOAD_DIR, basename);
      const ok = safeUnlink(target); // คืน true/false
      fileResults.push({
        name: basename,
        deleted: ok,
        path: target,
      });
    }

    return responseSuccess(res, "ลบเอกสารสำเร็จ", {
      docNo,
      affected: {
        documents: deletedDocs,
        products: deletedProducts,
        images: deletedImages,
      },
      files: fileResults,
    });
  } catch (e) {
    try {
      if (tx._aborted !== true) await tx.rollback();
    } catch (_) {}
    return responseError(res, e?.message || "ลบเอกสารไม่สำเร็จ", 500);
  }
}

module.exports = {
  deleteDocumentByDocNo,
};
