// middleware/errorHandler.js  (CommonJS)
const multer = require("multer");

function errorHandler(err, req, res, next) {
  // ถ้า response เริ่มส่งไปแล้ว ให้โยนต่อ
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    // ตัวอย่าง code: LIMIT_FILE_SIZE, LIMIT_UNEXPECTED_FILE, ฯลฯ
    let message = err.message || "อัปโหลดไม่สำเร็จ";
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "ไฟล์เกินขนาดสูงสุดที่อนุญาต";
    }
    return res
      .status(400)
      .json({ ok: false, error: "MULTER_ERROR", code: err.code, message });
  }

  // log ไว้ดูสาเหตุจริง
  console.error("[UNHANDLED ERROR]", err);
  const message = err?.message || "Server error";
  return res
    .status(err.statusCode || 500)
    .json({ ok: false, error: "SERVER_ERROR", message });
}

module.exports = { errorHandler };
