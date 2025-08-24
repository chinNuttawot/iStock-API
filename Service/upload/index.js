// controllers/upload/uploadController.js  (CommonJS)
const path = require("path");
const { buildFileResponse, validateMime } = require("../../utils/file");
const { listFiles, safeUnlink, safeJoin } = require("../../utils/fsx");
const { config } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

/** ตรวจ mime และส่ง error ถ้าไม่ผ่าน */
function assertAllowed(mime, allowedList) {
  // validateMime(allowed, mimetype)  <-- ตามที่ utils/file นิยามไว้
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
    allowedImageMimes: config.ALLOWED_IMAGE_MIME,
    allowedFileMimes: config.ALLOWED_FILE_MIME,
  });
}

/** POST /upload/image */
function uploadImage(req, res) {
  try {
    if (!req.file) {
      return responseError(res, 400, "ไม่พบไฟล์");
    }
    assertAllowed(req.file.mimetype, config.ALLOWED_IMAGE_MIME);
    const file = buildFileResponse(req, req.file.filename, req.file);
    return responseSuccess(res, "upload Image Success", {
      type: "image",
      file,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return responseError(res, status, "อัปโหลดรูปภาพไม่สำเร็จ", e.message);
  }
}

/** POST /upload/file */
function uploadFile(req, res) {
  try {
    if (!req.file) {
      return responseError(res, 400, "ไม่พบไฟล์");
    }
    assertAllowed(req.file.mimetype, config.ALLOWED_FILE_MIME);
    const file = buildFileResponse(req, req.file.filename, req.file);
    return responseSuccess(res, "upload File Success", {
      type: "file",
      file,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return responseError(res, status, "อัปโหลดไฟล์ไม่สำเร็จ", e.message);
  }
}

/** POST /upload/multi */
function uploadMultiple(req, res) {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return responseError(res, 400, "ไม่พบไฟล์");
    }

    // ตรวจ mime ของแต่ละไฟล์
    for (const f of files) {
      const isImage = f.mimetype.startsWith("image/");
      const allowed = isImage
        ? config.ALLOWED_IMAGE_MIME
        : config.ALLOWED_FILE_MIME;
      assertAllowed(f.mimetype, allowed);
    }

    const items = files.map((f) => buildFileResponse(req, f.filename, f));
    return responseSuccess(res, "upload Multi Success", {
      count: items.length,
      files: items,
    });
  } catch (e) {
    const status = e.statusCode || 500;
    return responseError(res, status, "อัปโหลดหลายไฟล์ไม่สำเร็จ", e.message);
  }
}

/** GET /files-list */
function listUploadedFiles(req, res) {
  try {
    const names = listFiles(config.UPLOAD_DIR);
    const host = `${req.protocol}://${req.get("host")}`;
    const files = names.map((name) => ({
      filename: name,
      url: `${host}/files/${name}`,
    }));
    return responseSuccess(res, "รายการไฟล์", { total: files.length, files });
  } catch (e) {
    return responseError(res, 500, "ไม่สามารถอ่านรายการไฟล์", e.message);
  }
}

/** DELETE /files/:name */
function deleteFile(req, res) {
  try {
    const target = safeJoin(config.UPLOAD_DIR, req.params.name);
    const ok = safeUnlink(target);
    if (!ok) {
      return responseError(res, 404, "ไม่พบไฟล์");
    }
    return responseSuccess(res, "ลบไฟล์แล้ว");
  } catch (e) {
    return responseError(res, 500, "ลบไฟล์ไม่สำเร็จ", e.message);
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
