// nav-cron.js
require("dotenv").config();
const cron = require("node-cron");
const storage = require("node-persist");
const dayjs = require("dayjs");
const axios = require("axios");
const https = require("https");

// ====== CONFIG ======
const TIMEZONE = "Asia/Bangkok";
const CRON_EXPR = "0 0 * * *"; // ทุกวัน 00:00
const MAX_RETRY = 3;
const RETRY_BASE_MS = 1000; // 1s, 2s, 4s...
const STORAGE_DIR = "storage"; // โฟลเดอร์เก็บข้อมูล node-persist
const RETENTION_DAYS = parseInt(process.env.NAV_RETENTION_DAYS || "1", 10);

// ใช้ ENV แทนที่จะฮาร์ดโค้ด
const NAV_URL = process.env.NAV_URL;
const NAV_USER = process.env.NAV_USER || "Pmc";
const NAV_PASS = process.env.NAV_PASS || "Pmc@1234";

// (ทางเลือก) รองรับ self-signed cert หากจำเป็น: NAV_REJECT_UNAUTHORIZED=false
const httpsAgent =
  String(process.env.NAV_REJECT_UNAUTHORIZED).toLowerCase() === "false"
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

// ====== HELPERS ======
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function initStorage() {
  await storage.init({
    dir: STORAGE_DIR,
    stringify: JSON.stringify,
    parse: JSON.parse,
    encoding: "utf8",
    logging: false,
    ttl: false,
  });
}

function getAuthHeader(user, pass) {
  const basic = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${basic}`;
}

async function getByUserNAV(username) {
  const latest = await storage.getItem("nav:latest");
  return latest.data.find((u) => u.userName === username) || null;
}

// ดึง NAV พร้อมรีทราย
async function getUserNAV() {
  if (!NAV_URL) {
    throw new Error("ENV NAV_URL ไม่ถูกตั้งค่า");
  }

  const headers = {
    Authorization: getAuthHeader(NAV_USER, NAV_PASS),
    "Content-Type": "application/json",
  };

  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    try {
      const res = await axios.get(NAV_URL, {
        headers,
        timeout: 10000,
        httpsAgent,
        // proxy: { host, port } // ถ้าต้องการ
      });

      const data = res.data?.value ?? res.data;
      return Array.isArray(data) ? data : [];
    } catch (err) {
      lastErr = err;
      const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[getUserNAV] attempt ${attempt}/${MAX_RETRY} failed: ${
          err.message || err
        }. retry in ${wait}ms`
      );
      if (attempt < MAX_RETRY) await sleep(wait);
    }
  }
  throw lastErr;
}

// เก็บผลลัพธ์ลง storage แยกตามวัน + เก็บ latest
async function saveNAVResult(data, meta = {}) {
  const now = dayjs();
  const ts = now.format("YYYY-MM-DD HH:mm:ss");
  // เก็บ snapshot ล่าสุด (ทับค่าเดิม)
  await storage.setItem("nav:latest", {
    ts,
    count: Array.isArray(data) ? data.length : 1,
    data,
    meta,
  });
}

// ---- CLEANUP: ลบคีย์รายวันที่เก่ากว่า RETENTION_DAYS ----
async function cleanupOldDailyKeys() {
  try {
    const keys = await storage.keys(); // รายชื่อคีย์ทั้งหมด
    const cutoff = dayjs().tz
      ? dayjs().tz(TIMEZONE).subtract(RETENTION_DAYS, "day").startOf("day")
      : dayjs().subtract(RETENTION_DAYS, "day").startOf("day");

    for (const key of keys) {
      // สนใจเฉพาะคีย์รูปแบบ nav:YYYY-MM-DD
      if (!key.startsWith("nav:")) continue;
      if (key === "nav:latest" || key === "nav:runs") continue;

      const m = key.match(/^nav:(\d{4}-\d{2}-\d{2})$/);
      if (!m) continue;

      const fileDate = dayjs(m[1], "YYYY-MM-DD").startOf("day");
      if (fileDate.isBefore(cutoff)) {
        try {
          await storage.removeItem(key);
          // eslint-disable-next-line no-console
          console.log(
            `[CLEANUP] removed key "${key}" (older than ${RETENTION_DAYS} days)`
          );
        } catch (e) {
          console.warn(
            `[CLEANUP] failed to remove key "${key}":`,
            e?.message || e
          );
        }
      }
    }
  } catch (e) {
    console.warn("[CLEANUP] error while cleaning keys:", e?.message || e);
  }
}

// งานหลัก (ดึง + เซฟ + ล้างของเก่า)
async function runJob() {
  console.log(`[NAV] Start job @ ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
  const meta = { url: NAV_URL, user: NAV_USER };
  try {
    const data = await getUserNAV();
    await saveNAVResult(data, meta);
    console.log(
      `[NAV] Saved ${Array.isArray(data) ? data.length : 1} records.`
    );
  } catch (err) {
    console.error("[NAV] Job failed:", err?.message || err);
  } finally {
    await cleanupOldDailyKeys();
  }
}

// ====== SCHEDULE ======
function scheduleJob() {
  cron.schedule(
    CRON_EXPR,
    async () => {
      await runJob();
    },
    { timezone: TIMEZONE }
  );
  console.log(`Cron scheduled: "${CRON_EXPR}" in ${TIMEZONE}`);
}

// ====== BOOTSTRAP ======
(async () => {
  await initStorage();

  // รันทันทีหนึ่งครั้งตอนสตาร์ท (ช่วยทดสอบได้)
  await runJob();

  // ตั้งเวลาเที่ยงคืนทุกวัน
  scheduleJob();
})();

// (ทางเลือก) export เผื่อเรียกที่อื่น
module.exports = { getUserNAV, runJob, getByUserNAV };
