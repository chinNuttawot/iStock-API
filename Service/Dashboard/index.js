// controllers/dashboard.controller.js
const { sql, poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

// แผนที่ menuId -> กลุ่ม (ปรับตามระบบจริง)
const MENU_GROUP_MAP = {
  1: "สแกนออก",
  2: "สแกนโอนย้าย",
  3: "สแกนตรวจนับ",
};

const BASE_GROUPS = ["สแกนออก", "สแกนโอนย้าย", "สแกนตรวจนับ"];
const TRACK_STATUSES = ["Pending Approval", "Approved", "Rejected"];

function makeEmptyDashboard() {
  return BASE_GROUPS.map((groupName) => ({
    groupName,
    items: TRACK_STATUSES.map((status) => ({ status, count: 0 })),
  }));
}

function getQueryParam(req, key) {
  if (req.query && req.query[key] != null) return String(req.query[key]).trim();

  const raw = (req._parsedUrl && req._parsedUrl.query) || "";
  const pairs = raw.split(/[&;]/g);
  for (const pair of pairs) {
    const [k, v = ""] = pair.split("=");
    if (decodeURIComponent(k) === key) return decodeURIComponent(v).trim();
  }
  return "";
}

async function getDashboard(req, res) {
  try {
    const branchCode = getQueryParam(req, "branchCode"); // e.g. "10CKR|10CK1"
    const user = getQueryParam(req, "user"); // e.g. "chin" หรือ "chin|john"

    const dashboard = makeEmptyDashboard();

    const pool = await poolPromise;
    const pReq = new sql.Request(pool);

    // WHERE parts
    const whereParts = [];

    // track เฉพาะ 3 สถานะ
    TRACK_STATUSES.forEach((s, i) => pReq.input(`s${i}`, sql.VarChar(50), s));
    whereParts.push(
      `d.[status] IN (${TRACK_STATUSES.map((_, i) => `@s${i}`).join(", ")})`
    );

    // branchCode filter (รองรับหลายค่า | )
    if (branchCode) {
      const branches = branchCode
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      if (branches.length > 0) {
        const placeholders = branches.map((_, i) => `@br${i}`).join(", ");
        whereParts.push(`d.[branchCode] IN (${placeholders})`);
        branches.forEach((br, i) => pReq.input(`br${i}`, sql.VarChar(20), br));
      }
    }

    // createdBy filter (รองรับหลายค่า | และ LIKE case-insensitive)
    if (user) {
      const creators = user
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);

      if (creators.length > 0) {
        // ใช้ OR สำหรับหลายค่า: (UPPER(d.createdBy) LIKE UPPER(@cb0) OR ...)
        const ors = creators.map(
          (_, i) => `UPPER(d.[createdBy]) LIKE UPPER(@cb${i})`
        );
        whereParts.push(`(${ors.join(" OR ")})`);

        creators.forEach((c, i) => {
          pReq.input(`cb${i}`, sql.VarChar(100), `%${c}%`); // partial match
        });
      }
    }

    const whereSql = whereParts.length
      ? `WHERE ${whereParts.join(" AND ")}`
      : "";

    // ใช้ตาราง fully-qualified
    const sqlText = `
      SELECT d.[menuId], d.[status], COUNT(1) AS cnt
      FROM  [Documents iStock] d
      ${whereSql}
      GROUP BY d.[menuId], d.[status]
    `;

    const rs = await pReq.query(sqlText);

    // อัปเดตผลลงใน dashboard
    for (const row of rs.recordset) {
      const groupName = MENU_GROUP_MAP[row.menuId];
      if (!groupName) continue;

      const g = dashboard.find((x) => x.groupName === groupName);
      if (!g) continue;

      const item = g.items.find((it) => it.status === row.status);
      if (item) item.count = Number(row.cnt) || 0;
    }

    return responseSuccess(res, "Dashboard fetched", dashboard);
  } catch (err) {
    // console.error(err);
    return responseError(res, "ไม่สามารถดึง Dashboard ได้", 500);
  }
}

module.exports = { getDashboard };
