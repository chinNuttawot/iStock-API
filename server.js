// server.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");

const APIs = require("./Service/api"); // Router อื่น ๆ ของคุณ
const { errorHandler } = require("./middleware/errorHandler");
const { config } = require("./config/db"); // ต้องมี config.UPLOAD_DIR

const app = express();
const port = Number(process.env.PORT) || 3000;

// ======== Security / Proxy basics ========
app.disable("x-powered-by");
app.set("trust proxy", true); // อยู่หลัง Nginx ให้เชื่อ X-Forwarded-*

// ======== Optional CORS (เปิดเมื่อทดสอบจาก device แอป) ========
// const cors = require("cors");
// app.use(cors({ origin: "*", credentials: false }));

// ======== Body parsers with larger limits ========
const BODY_LIMIT = process.env.BODY_LIMIT || "1gb"; // เดิม 200mb → ขยาย
app.use(express.json({ limit: BODY_LIMIT }));
app.use(
  express.urlencoded({
    extended: true,
    limit: BODY_LIMIT,
    parameterLimit: 100000,
  })
);

// (ทางเลือก) ถ้าต้องรับ binary/raw โดยไม่ใช่ multipart
// app.use("/api/upload-raw", express.raw({ type: "*/*", limit: BODY_LIMIT }));

// ======== Ensure upload dir exists ========
fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });

// ======== Static files (/files) ========
app.use(
  "/files",
  express.static(config.UPLOAD_DIR, {
    fallthrough: false, // ไม่พบไฟล์ -> ตอบ 404
    etag: true,
    lastModified: true,
    maxAge: "7d",
    setHeaders(res /*, filePath */) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// ======== Multer for multipart (upload multi) ========
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = (file.originalname || "file")
      .replace(/[^\w.\-]/g, "_")
      .replace(/_+/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB/ไฟล์ (ปรับได้)
    files: 20, // สูงสุด 20 ไฟล์/คำขอ
  },
});

// ✅ อัปโหลดหลายไฟล์: POST /api/upload/multi (field name = "files")
app.post("/api/upload/multi", upload.array("files", 20), (req, res) => {
  const files = (req.files || []).map((f) => ({
    name: f.filename,
    size: f.size,
    mime: f.mimetype,
    url: `/files/${f.filename}`,
  }));
  return res.json({ ok: true, count: files.length, files });
});

// ======== Health check ========
app.get("/healthz", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ======== Mount APIs router (ของคุณ) ========
app.use("/api", APIs);

// ======== Friendly 413 handler (body-parser / multer) ========
app.use((err, req, res, next) => {
  // body-parser เกิน limit -> 413
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({
      ok: false,
      message:
        "Payload too large. Please reduce file size or contact admin to increase the limit.",
      limit: BODY_LIMIT,
    });
  }
  // multer เกิน fileSize
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      ok: false,
      message: "File too large.",
      maxFileSize: "200MB",
    });
  }
  return next(err);
});

// ======== Global error handler (สุดท้ายจริง ๆ) ========
app.use(errorHandler);

// ======== Start server with extended timeouts ========
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
  console.log(
    `   Static files at /files -> ${path.resolve(config.UPLOAD_DIR)}`
  );
});

// Timeouts สำหรับงานอัปโหลด/ดาวน์โหลดนาน ๆ
// Node v18+: ใช้พวกนี้ได้
server.requestTimeout = 10 * 60 * 1000; // 10 นาที
server.headersTimeout = 11 * 60 * 1000; // headers เผื่อมากกว่าเล็กน้อย
server.keepAliveTimeout = 120 * 1000; // keep-alive 120s
// (ถ้าใช้ Node รุ่นเก่ามาก อาจต้องใช้ server.setTimeout(...) แทน)
