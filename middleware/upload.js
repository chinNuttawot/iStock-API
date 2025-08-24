// middleware/upload.js  (CommonJS)
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { config } = require("../config/db");
const { ensureDir } = require("../utils/fsx");
const { resolveExt } = require("../utils/file");

ensureDir(config.UPLOAD_DIR);

/** สร้าง storage สำหรับ multer */
function createDiskStorage() {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = resolveExt(file.mimetype, file.originalname);
      cb(null, `${uuidv4()}.${ext}`);
    },
  });
}

/** อัปโหลดพื้นฐาน (ยังไม่กรอง mime ที่นี่) */
const baseUpload = multer({
  storage: createDiskStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE },
});

/** เฉพาะรูปภาพ (ตรวจ mime ภายหลังใน controller) */
const uploadImageSingle = baseUpload.single("image");

/** เฉพาะไฟล์ทั่วไป (ตรวจ mime ภายหลังใน controller) */
const uploadFileSingle = baseUpload.single("file");

/** อัปโหลดหลายไฟล์รวมกัน (ภาพ + เอกสาร) */
const uploadMulti = baseUpload.array("files", 10);

module.exports = {
  baseUpload,
  uploadImageSingle,
  uploadFileSingle,
  uploadMulti,
};
