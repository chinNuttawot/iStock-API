// utils/fsx.js
const fs = require("fs");
const path = require("path");

/** สร้างโฟลเดอร์หากยังไม่มี */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/** อ่านรายชื่อไฟล์ในโฟลเดอร์เป็น array ของชื่อไฟล์ */
function listFiles(dirPath) {
  return fs.readdirSync(dirPath);
}

/** ลบไฟล์แบบปลอดภัย (return true/false) */
function safeUnlink(absPath) {
  try {
    fs.unlinkSync(absPath);
    return true;
  } catch (e) {
    return false;
  }
}

/** ป้องกัน path traversal แค่ basename */
function safeJoin(baseDir, name) {
  return path.join(baseDir, path.basename(name));
}

module.exports = {
  ensureDir,
  listFiles,
  safeUnlink,
  safeJoin,
};
