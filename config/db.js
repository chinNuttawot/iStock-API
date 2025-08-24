// โหลด .env ต้องอยู่บนสุดเสมอ
require("dotenv").config();

const path = require("path");
const sql = require("mssql");

// helper: แปลงสตริงคอมมาให้เป็นอาเรย์ที่สะอาด
function envList(key, fallback = "") {
  return (process.env[key] ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ====== App Config ======
const config = {
  PORT: Number(process.env.PORT || 3000),

  UPLOAD_DIR: path.resolve(process.cwd(), process.env.UPLOAD_DIR || "uploads"),
  MAX_FILE_SIZE_MB: Number(process.env.MAX_FILE_SIZE_MB || 10),
  get MAX_FILE_SIZE() {
    return this.MAX_FILE_SIZE_MB * 1024 * 1024;
  },

  // MIME whitelist (สำคัญ: ต้องเป็น array)
  ALLOWED_IMAGE_MIME: envList(
    "ALLOWED_IMAGE_MIME",
    "image/png,image/jpeg,image/jpg,image/webp"
  ),
  ALLOWED_FILE_MIME: envList(
    "ALLOWED_FILE_MIME",
    "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,text/plain"
  ),

  // JWT (ถ้าต้องใช้ใน checkToken)
  JWT_SECRET: process.env.JWT_SECRET,

  // SQL Server
  DB_USER: process.env.DB_USER,
  DB_PASS: process.env.DB_PASS,
  DB_SERVER: process.env.DB_SERVER,
  DB_NAME: process.env.DB_NAME,
  DB_PORT: parseInt(process.env.DB_PORT || "1833", 10),

  // (ถ้าจะใช้ NAV URLs ก็รวมไว้ได้)
  NAV_URL: process.env.NAV_URL,
  NAV_URL_TRANSFER_ORDER_WS: process.env.NAV_URL_TRANSFER_ORDER_WS,
  NAV_URL_TRANSFER_ORDER_DETAIL_WS:
    process.env.NAV_URL_TRANSFER_ORDER_DETAIL_WS,
};

// ====== SQL Server Connection Pool ======
const sqlConfig = {
  user: config.DB_USER,
  password: config.DB_PASS,
  server: config.DB_SERVER,
  database: config.DB_NAME,
  port: config.DB_PORT,
  options: {
    encrypt: false, // ปิดถ้าใช้ self-signed cert
    trustServerCertificate: true,
  },
};

const poolPromise = new sql.ConnectionPool(sqlConfig)
  .connect()
  .then((pool) => {
    console.log("✅ Connected to SQL Server");
    return pool;
  })
  .catch((err) => {
    console.error("❌ Database connection failed:", err);
    throw err;
  });

// ====== Export ======
module.exports = {
  config,
  sql,
  poolPromise,
};
