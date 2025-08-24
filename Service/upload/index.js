// controllers/upload/uploadController.js  (CommonJS)
const path = require("path");
const { buildFileResponse, validateMime } = require("../../utils/file");
const { listFiles, safeUnlink, safeJoin } = require("../../utils/fsx");
const { config } = require("../../config/db");
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
function uploadImage(req, res) {
  try {
    const {
      keyRef1 = null,
      keyRef2 = null,
      keyRef3 = null,
      remark = null,
    } = req.body;

    if (!keyRef1) {
      return responseError(res, "keyRef1 not found", 400);
    }

    if (!req.file) {
      dlog("req.file is empty");
      return responseError(res, "empty file", 400);
    }
    dlog("image:", {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });

    assertAllowed(req.file.mimetype, ALLOW_IMG);
    const file = buildFileResponse(req, req.file.filename, req.file);

    // ใช้ 200 ผ่าน helper เดิม (ต้องการ 201 ค่อยเปลี่ยน helper ให้รับ status ได้)
    return responseSuccess(res, "upload Image Success", {
      type: "image",
      file,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    dlog("image error:", e.message);
    return responseError(res, "อัปโหลดรูปภาพไม่สำเร็จ", status);
  }
}

/** POST /upload/file */
function uploadFile(req, res) {
  try {
    const {
      keyRef1 = null,
      keyRef2 = null,
      keyRef3 = null,
      remark = null,
    } = req.body;

    if (!keyRef1) {
      return responseError(res, "keyRef1 not found", 400);
    }

    if (!req.file) {
      dlog("req.file is empty");
      return responseError(res, "ไม่พบไฟล์", 400);
    }
    dlog("file:", {
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
    });

    assertAllowed(req.file.mimetype, ALLOW_FILE);
    const file = buildFileResponse(req, req.file.filename, req.file);

    return responseSuccess(res, "upload File Success", {
      type: "file",
      file,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    dlog("file error:", e.message);
    return responseError(res, "อัปโหลดไฟล์ไม่สำเร็จ", status);
  }
}

/** POST /upload/multi */
function uploadMultiple(req, res) {
  try {
    const {
      keyRef1 = null,
      keyRef2 = null,
      keyRef3 = null,
      remark = null,
    } = req.body;

    if (!keyRef1) {
      return responseError(res, "keyRef1 not found", 400);
    }

    const files = req.files || [];
    if (files.length === 0) {
      dlog("req.files is empty");
      return responseError(res, "ไม่พบไฟล์", 400);
    }

    for (const f of files) {
      const isImage = f.mimetype.startsWith("image/");
      const allowed = isImage ? ALLOW_IMG : ALLOW_FILE;
      assertAllowed(f.mimetype, allowed);
    }

    const items = files.map((f) => buildFileResponse(req, f.filename, f));
    dlog("multi count:", items.length);

    return responseSuccess(res, "upload Multi Success", {
      count: items.length,
      files: items,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    dlog("multi error:", e.message);
    return responseError(res, "อัปโหลดหลายไฟล์ไม่สำเร็จ", status);
  }
}

/** GET /files-list */
function listUploadedFiles(req, res) {
  try {
    const names = listFiles(config.UPLOAD_DIR);
    const host = `${req.protocol}://${req.get("host")}`;
    const files = names.map((name) => ({
      filename: name,
      url: `${host}/files/${name}`, // ทาง A: public static
    }));
    return responseSuccess(res, "รายการไฟล์", { total: files.length, files });
  } catch (e) {
    return responseError(res, "ไม่สามารถอ่านรายการไฟล์", 500);
  }
}

/** DELETE /files/:name */
function deleteFile(req, res) {
  try {
    const target = safeJoin(config.UPLOAD_DIR, req.params.name);
    const ok = safeUnlink(target);
    if (!ok) {
      return responseError(res, "ไม่พบไฟล์", 404);
    }
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
