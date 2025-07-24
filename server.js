const express = require("express");
const { Login } = require("./Service/Login");
const { Logout } = require("./Service/Logout");
const { Register } = require("./Service/Register");
const { checkToken } = require("./middleware/checkToken");
const { GetProfile } = require("./Service/Profile");
const { getMenus } = require("./Service/Menu");
const { getDashboard } = require("./Service/Dashboard");
const { getCardList } = require("./Service/Card");
const { getCardDetail } = require("./Service/CardDetail");
const { CreateDocument } = require("./Service/CreateDocument");
const { getWorkOrderStatus } = require("./Service/WorkOrderStatus");
const { getWorkOrderNames } = require("./Service/WorkOrderNames");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});

// post
app.post("/api/Login", Login);
app.post("/api/Logout", checkToken, Logout);
app.post("/api/Register", Register);

// get
app.get("/api/Profile", checkToken, GetProfile);
app.get("/api/Menus", checkToken, getMenus);
app.get("/api/Dashboard", checkToken, getDashboard);
app.get("/api/CardList", checkToken, getCardList);
app.get("/api/CardDetailList", checkToken, getCardDetail);
app.get("/api/CreateDocument", checkToken, CreateDocument);
app.get("/api/WorkOrderStatus", checkToken, getWorkOrderStatus);
app.get("/api/WorkOrderNames", checkToken, getWorkOrderNames);