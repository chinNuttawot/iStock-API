const express = require("express");
const APIs = require("./Service/api");
const cron = require("node-cron");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.listen(port, "0.0.0.0", () => {
  console.log(`Listening at http://localhost:${port}`);
});

app.use("/api", APIs);
