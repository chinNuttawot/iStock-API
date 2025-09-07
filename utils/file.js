// utils/file.js
const path = require("path");
const mime = require("mime-types");
require("dotenv").config();

/** สร้าง response object ของไฟล์ */
function buildFileResponse(req, filename, file) {
  const port = Number(process.env.PORT_HTTPS) || 8443;
  const host = `${req.protocol}://${req.get("host")}`;
  return {
    originalName: file?.originalname,
    mime: file?.mimetype,
    size: file?.size,
    filename,
    url: `${host}:${port}/files/${filename}`,
  };
}

/** คืนค่านามสกุลจาก mimetype หรือชื่อไฟล์เดิม */
function resolveExt(mimetype, originalname) {
  return (
    mime.extension(mimetype) ||
    path.extname(originalname).replace(".", "") ||
    "bin"
  );
}

/** ตรวจว่า mimetype อยู่ใน whitelist */
function validateMime(allowed, mimetype) {
  return allowed.includes(mimetype);
}

module.exports = {
  buildFileResponse,
  resolveExt,
  validateMime,
};
