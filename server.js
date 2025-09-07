// server.js
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
// const cors = require("cors"); // เปิดเมื่อทดสอบจาก device/web ข้ามโดเมน

const APIs = require("./Service/api"); // Router อื่น ๆ ของคุณ
const { errorHandler } = require("./middleware/errorHandler");
const { config } = require("./config/db"); // ต้องมี config.UPLOAD_DIR

const app = express();
const port = Number(process.env.PORT) || 3000;

// ======== Security / Proxy basics ========
app.disable("x-powered-by");
app.set("trust proxy", true); // อยู่หลัง Nginx ให้เชื่อ X-Forwarded-*

// ======== Optional CORS (เปิดเมื่อทดสอบจาก device แอป/เว็บต่างพอร์ต) ========
// const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";
// app.use(cors({ origin: ALLOW_ORIGIN, credentials: false }));
// app.use((req, res, next) => {
//   if (req.method === "OPTIONS") {
//     res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
//     res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
//     res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
//     return res.status(204).end();
//   }
//   next();
// });

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

// ======== Helper: base URL หลัง proxy ========
function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http")
    .split(",")[0]
    .trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

// ======== Multer for multipart (upload multi) ========
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 200); // 200MB/ไฟล์
const MAX_FILES_PER_REQ = Number(process.env.MAX_FILES_PER_REQ || 20);

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
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: MAX_FILES_PER_REQ,
  },
});

// ✅ อัปโหลดหลายไฟล์: POST /api/upload/multi (field name = "files")
app.post(
  "/api/upload/multi",
  upload.array("files", MAX_FILES_PER_REQ),
  (req, res) => {
    const base = getBaseUrl(req);
    const files = (req.files || []).map((f) => ({
      name: f.filename,
      size: f.size,
      mime: f.mimetype,
      url: `${base}/files/${f.filename}`, // absolute URL ใช้ได้หลัง Nginx
    }));
    return res.json({ ok: true, count: files.length, files });
  }
);

// ======== Health check ========
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    now: new Date().toISOString(),
  });
});
app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    now: new Date().toISOString(),
  });
});

// ======== Mount APIs router (ของคุณ) ========
app.use("/api", APIs);

// ======== Friendly 413/ข้อจำกัดอัปโหลด (body-parser / multer) ========
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
      maxFileSize: `${MAX_FILE_SIZE_MB}MB`,
    });
  }
  // multer เกินจำนวนไฟล์
  if (err && err.code === "LIMIT_FILE_COUNT") {
    return res.status(413).json({
      ok: false,
      message: "Too many files.",
      maxFiles: MAX_FILES_PER_REQ,
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

// Timeouts สำหรับงานอัปโหลด/ดาวน์โหลดนาน ๆ (Node v18+)
server.requestTimeout = 10 * 60 * 1000; // 10 นาที
server.headersTimeout = 11 * 60 * 1000; // headers เผื่อมากกว่าเล็กน้อย
server.keepAliveTimeout = 120 * 1000; // keep-alive 120s
// (ถ้าใช้ Node รุ่นเก่ามาก อาจต้องใช้ server.setTimeout(...) แทน)
