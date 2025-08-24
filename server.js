const express = require("express");
const APIs = require("./Service/api");
const { errorHandler } = require("./middleware/errorHandler");
const { config } = require("./config/db");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  "/files",
  express.static(config.UPLOAD_DIR, {
    fallthrough: false, // ถ้าไม่เจอไฟล์ → 404 ทันที
    etag: true,
    lastModified: true,
    maxAge: "7d", // cache ฝั่งเบราว์เซอร์ 7 วัน (ปรับได้)
    setHeaders(res, filePath) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // ถ้าอยากบังคับดาวน์โหลดบางนามสกุล:
      // if (filePath.endsWith(".pdf")) res.setHeader("Content-Disposition", "inline");
      // ถ้าอยากบังคับโหลดไฟล์เสมอ: res.setHeader("Content-Disposition", "attachment");
    },
  })
);

app.use("/api", APIs);
app.use(errorHandler);

app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
});
