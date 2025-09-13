// utils/dateFormatter.js

/**
 * ใช้สำหรับ format วันที่/เวลา ให้เป็น ISO string
 * เช่น createdAt: "2025-09-01T13:18:13.714Z"
 */
function formatToISO(date) {
  return new Date(date).toISOString();
}

/**
 * ใช้สำหรับ format วันที่อย่างเดียว
 * จะ fix เวลาเป็น 00:00:00.000Z
 * เช่น stockOutDate: "2025-09-01T00:00:00.000Z"
 */
function formatDateOnly(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * คืนค่าวันปัจจุบันแบบ ISO โดย fix เวลาเป็น 00:00:00.000Z
 */
function getTodayISO() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString();
}

module.exports = {
  formatToISO,
  formatDateOnly,
  getTodayISO,
};
