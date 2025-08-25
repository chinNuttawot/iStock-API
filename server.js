// server.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const APIs = require("./Service/api");
const { errorHandler } = require("./middleware/errorHandler");
const { config } = require("./config/db");

const app = express();
const port = process.env.PORT || 3000;

// ===== Security/Proxy basics =====
app.disable("x-powered-by");
app.set("trust proxy", true); // อยู่หลัง Nginx ให้เชื่อ header X-Forwarded-*

// ===== Body parsers with larger limits =====
app.use(
  express.json({
    limit: process.env.BODY_LIMIT || "200mb", // JSON payload
    // คุณอาจอยากรับ text/plain ด้วย:
    // type: ["application/json", "text/plain"]
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.BODY_LIMIT || "200mb", // form-urlencoded
    parameterLimit: 100000, // กันโดนตัด query/fields เยอะๆ
  })
);

// (ถ้าใช้ raw/binary ผ่าน fetch PUT/POST แบบไม่มี multipart)
// app.use("/api/upload-raw", express.raw({ type: "*/*", limit: process.env.BODY_LIMIT || "200mb" }));

// ===== Static files (/files) =====
app.use(
  "/files",
  express.static(config.UPLOAD_DIR, {
    fallthrough: false, // ไม่พบไฟล์ -> 404
    etag: true,
    lastModified: true,
    maxAge: "7d", // cache ฝั่ง browser 7 วัน
    setHeaders(res, filePath) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // ถ้าบางชนิดอยาก inline/attachment ปรับตรงนี้ได้
      // if (filePath.endsWith(".pdf")) res.setHeader("Content-Disposition", "inline");
    },
  })
);

// (ทางเลือก) เผื่อคุณต้องการอัปไฟล์แบบ multipart/form-data ด้วย multer
// **ถ้าคุณจัดการใน ./Service/api อยู่แล้ว ข้ามส่วนนี้ได้**
/*
const multer = require("multer");
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, config.UPLOAD_DIR),
    filename: (req, file, cb) => {
      const safeName = Date.now() + "_" + file.originalname.replace(/[^\w.\-]/g, "_");
      cb(null, safeName);
    },
  }),
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
    files: 20, // จำนวนไฟล์สูงสุดต่อหนึ่งคำขอ
  },
});
app.post("/api/upload", upload.array("files", 20), (req, res) => {
  res.json({
    ok: true,
    count: (req.files || []).length,
    files: (req.files || []).map(f => ({
      name: f.filename,
      size: f.size,
      url: `/files/${f.filename}`,
    })),
  });
});
*/

// ===== APIs =====
app.use("/api", APIs);

// ===== Friendly 413 handler from body-parser/multer =====
app.use((err, req, res, next) => {
  // body-parser เกิน limit จะเป็น 413
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({
      ok: false,
      message:
        "Payload too large. Please reduce file size or contact admin to increase the limit.",
      limit: process.env.BODY_LIMIT || "200mb",
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

// ===== Global error handler =====
app.use(errorHandler);

// ===== Health check =====
app.get("/healthz", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
  console.log(`   Static files at /files -> ${path.resolve(config.UPLOAD_DIR)}`);
});
