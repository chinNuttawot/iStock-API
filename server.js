const express = require("express");
const APIs = require("./Service/api");
const cron = require("node-cron");
const { errorHandler } = require("./middleware/errorHandler");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", APIs);
app.use(errorHandler);

app.listen(port, "0.0.0.0", () => {
  console.log(`✅ Server listening at http://localhost:${port}`);
});
