// controllers/upload/uploadController.js  (CommonJS)
const path = require("path");
const { buildFileResponse, validateMime } = require("../../utils/file");
const { listFiles, safeUnlink, safeJoin } = require("../../utils/fsx");
const { sql, poolPromise, config } = require("../../config/db"); // ⬅️ เพิ่ม sql, poolPromise
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const DEBUG = process.env.DEBUG_UPLOAD === "1";
const ALLOW_IMG = Array.isArray(config.ALLOWED_IMAGE_MIME)
  ? config.ALLOWED_IMAGE_MIME
  : [];
const ALLOW_FILE = Array.isArray(config.ALLOWED_FILE_MIME)
  ? config.ALLOWED_FILE_MIME
  : [];

/** util: log เฉพาะตอนเปิด DEBUG_UPLOAD=1 */
function dlog(...args) {
  if (DEBUG) console.log("[upload]", ...args);
}

/** ตรวจ mime และส่ง error ถ้าไม่ผ่าน */
function assertAllowed(mime, allowedList) {
  if (!validateMime(allowedList, mime)) {
    const e = new Error(`ไม่รองรับชนิดไฟล์: ${mime}`);
    e.statusCode = 400;
    throw e;
  }
}

/** helper: บันทึกแถวใหม่ลง [Image iStock] แล้วคืนค่าที่ถูกแทรก */
async function insertImageRow({
  keyRef1 = null,
  keyRef2 = null,
  keyRef3 = null,
  remark = null,
  picURL = null,
  createdBy,
}) {
  const pool = await poolPromise;
  const rq = new sql.Request(pool);

  rq.input("keyRef1", sql.NVarChar(100), keyRef1);
  rq.input("keyRef2", sql.NVarChar(100), keyRef2);
  rq.input("keyRef3", sql.NVarChar(100), keyRef3);
  rq.input("remark", sql.NVarChar(500), remark);
  rq.input("picURL", sql.NVarChar(1000), picURL);
  rq.input("createdBy", sql.NVarChar(100), createdBy);

  const rs = await rq.query(`
    INSERT INTO [dbo].[Image iStock]
      ([keyRef1],[keyRef2],[keyRef3],[remark],[picURL],[createdBy])
    OUTPUT
      inserted.[id],
      inserted.[keyRef1],
      inserted.[keyRef2],
      inserted.[keyRef3],
      inserted.[remark],
      inserted.[picURL],
      inserted.[createdBy],
      inserted.[createdAt]
    VALUES
      (@keyRef1,@keyRef2,@keyRef3,@remark,@picURL,@createdBy);
  `);

  return rs.recordset[0];
}

/** GET / => สถานะระบบ */
function getHealth(req, res) {
  return responseSuccess(res, "Upload API is running", {
    port: config.PORT,
    uploadDir: path.relative(process.cwd(), config.UPLOAD_DIR),
    maxFileSizeMB: config.MAX_FILE_SIZE_MB,
    allowedImageMimes: ALLOW_IMG,
    allowedFileMimes: ALLOW_FILE,
  });
}

/** POST /upload/image */
async function uploadImage(req, res) {
  try {
    const {
      keyRef1 = null,
      keyRef2 = null,
      keyRef3 = null,
      remark = null,
      createdBy = null,
    } = req.body || {};

    if (!keyRef1) return responseError(res, "keyRef1 not found", 400);
    if (!createdBy) return responseError(res, "createdBy is required", 400);

    if (!req.file) {
      dlog("req.file is empty");
      return responseError(res, "empty file", 400);
    }
    dlog("image:", {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });

    // ตรวจ MIME
    assertAllowed(req.file.mimetype, ALLOW_IMG);

    // สร้างข้อมูลไฟล์ (ได้ URL/public path)
    const file = buildFileResponse(req, req.file.filename, req.file);

    // บันทึก DB
    const inserted = await insertImageRow({
      keyRef1,
      keyRef2,
      keyRef3,
      remark,
      picURL: file.url, // ใช้ URL จาก buildFileResponse
      createdBy,
    });

    // ส่งกลับ
    return responseSuccess(res, "upload Image Success", {
      type: "image",
      file,
      record: inserted,
    });
  } catch (e) {
    const status =
      e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
    dlog("image error:", e.message);
    return responseError(res, "อัปโหลดรูปภาพไม่สำเร็จ", status);
  }
}

/** POST /upload/file */
async function uploadFile(req, res) {
  try {
    const {
      keyRef1 = null,
      keyRef2 = null,
      keyRef3 = null,
      remark = null,
      createdBy = null,
    } = req.body || {};

    if (!keyRef1) return responseError(res, "keyRef1 not found", 400);
    if (!createdBy) return responseError(res, "createdBy is required", 400);

    if (!req.file) {
      dlog("req.file is empty");
      return responseError(res, "ไม่พบไฟล์", 400);
    }
    dlog("file:", {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });

    // ตรวจ MIME (ไฟล์ทั่วไป)
    assertAllowed(req.file.mimetype, ALLOW_FILE);

    // response file
    const file = buildFileResponse(req, req.file.filename, req.file);

    // บันทึก DB
    const inserted = await insertImageRow({
      keyRef1,
      keyRef2,
      keyRef3,
      remark,
      picURL: file.url,
      createdBy,
    });

    return responseSuccess(res, "upload File Success", {
      type: "file",
      file,
      record: inserted,
    });
  } catch (e) {
    const status =
      e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
    dlog("file error:", e.message);
    return responseError(res, "อัปโหลดไฟล์ไม่สำเร็จ", status);
  }
}

/** POST /upload/multi */
async function uploadMultiple(req, res) {
  try {
    const {
      keyRef1 = null,
      keyRef2 = null,
      keyRef3 = null,
      remark = null,
      createdBy = null,
    } = req.body || {};

    if (!keyRef1) return responseError(res, "keyRef1 not found", 400);
    if (!createdBy) return responseError(res, "createdBy is required", 400);

    const files = req.files || [];
    if (files.length === 0) {
      dlog("req.files is empty");
      return responseError(res, "ไม่พบไฟล์", 400);
    }

    // ตรวจ MIME ทุกไฟล์ก่อน
    for (const f of files) {
      const isImage = f.mimetype.startsWith("image/");
      const allowed = isImage ? ALLOW_IMG : ALLOW_FILE;
      assertAllowed(f.mimetype, allowed);
    }

    // สร้าง file responses
    const items = files.map((f) => buildFileResponse(req, f.filename, f));
    dlog("multi count:", items.length);

    // บันทึก DB ทีละไฟล์ (parallel)
    const inserted = await Promise.all(
      items.map((file) =>
        insertImageRow({
          keyRef1,
          keyRef2,
          keyRef3,
          remark,
          picURL: file.url,
          createdBy,
        })
      )
    );

    return responseSuccess(res, "upload Multi Success", {
      count: items.length,
      files: items,
      records: inserted,
    });
  } catch (e) {
    const status =
      e.statusCode && Number.isInteger(e.statusCode) ? e.statusCode : 500;
    dlog("multi error:", e.message);
    return responseError(res, "อัปโหลดหลายไฟล์ไม่สำเร็จ", status);
  }
}

// GET /files-list
async function listUploadedFiles(req, res) {
  try {
    const keyRef1 = req.query.keyRef1?.trim() || null;
    const keyRef2 = req.query.keyRef2?.trim() || null;
    const keyRef3 = req.query.keyRef3?.trim() || null;
    const q = req.query.q?.trim() || null;

    if (!keyRef1) return responseError(res, "keyRef1 not found", 400);

    const where = [];
    if (keyRef1) where.push("[keyRef1] = @keyRef1");
    if (keyRef2) where.push("[keyRef2] = @keyRef2");
    if (keyRef3) where.push("[keyRef3] = @keyRef3");
    if (q)
      where.push(
        "([remark] LIKE @kw OR [picURL] LIKE @kw OR [createdBy] LIKE @kw)"
      );
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const pool = await poolPromise;

    // --- query ทั้งหมด ---
    const lReq = new sql.Request(pool);
    if (keyRef1) lReq.input("keyRef1", sql.NVarChar(100), keyRef1);
    if (keyRef2) lReq.input("keyRef2", sql.NVarChar(100), keyRef2);
    if (keyRef3) lReq.input("keyRef3", sql.NVarChar(100), keyRef3);
    if (q) lReq.input("kw", sql.NVarChar(500), `%${q}%`);

    const rs = await lReq.query(`
      SELECT
        [id],
        [keyRef1],
        [keyRef2],
        [keyRef3],
        [remark],
        [picURL],
        [createdBy],
        [createdAt]
      FROM [dbo].[Image iStock]
      ${whereSql}
      ORDER BY [createdAt] DESC, [id] DESC
    `);

    const items = (rs.recordset || []).map((r) => ({
      id: r.id,
      keyRef1: r.keyRef1,
      keyRef2: r.keyRef2,
      keyRef3: r.keyRef3,
      remark: r.remark,
      url: r.picURL,
      filename: r.picURL ? path.basename(r.picURL) : null,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
    }));

    return responseSuccess(res, "รายการไฟล์", items);
  } catch (e) {
    return responseError(res, "ไม่สามารถอ่านรายการไฟล์", 500);
  }
}

/** DELETE /files/:name */
function deleteFile(req, res) {
  try {
    const target = safeJoin(config.UPLOAD_DIR, req.params.name);
    const ok = safeUnlink(target);
    if (!ok) return responseError(res, "ไม่พบไฟล์", 404);
    return responseSuccess(res, "ลบไฟล์แล้ว");
  } catch (e) {
    return responseError(res, "ลบไฟล์ไม่สำเร็จ", 500);
  }
}

module.exports = {
  getHealth,
  uploadImage,
  uploadFile,
  uploadMultiple,
  listUploadedFiles,
  deleteFile,
};
