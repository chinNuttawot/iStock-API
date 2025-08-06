const express = require("express");
const { Login } = require("../Login");
const { Logout } = require("../Logout");
const { Register } = require("../Register");
const { GetProfile } = require("../Profile");
const { getMenus } = require("../Menu");
const { getDashboard } = require("../Dashboard");
const { getCardList } = require("../Card");
const { getCardDetail } = require("../CardDetail");
const { CreateDocument } = require("../CreateDocument");
const { getWorkOrderStatus } = require("../WorkOrderStatus");
const { getWorkOrderNames } = require("../WorkOrderNames");
const { checkToken } = require("../../middleware/checkToken");
const { TestAPI } = require("../Test");
const { deleteAccount } = require("../DeleteAccount");
const { getOrderStatusList } = require("../OrderStatusList");
const APIs = express.Router();

// post
APIs.post("/", checkToken, TestAPI);
APIs.post("/Login", Login);
APIs.post("/Logout", checkToken, Logout);
APIs.post("/Register", Register);
APIs.post("/DeleteAccount", deleteAccount);

// get
APIs.get("/", checkToken, TestAPI);
APIs.get("/OrderStatusList", checkToken, getOrderStatusList);
APIs.get("/Profile", checkToken, GetProfile);
APIs.get("/Menus", checkToken, getMenus);
APIs.get("/Dashboard", checkToken, getDashboard);
APIs.get("/CardList", checkToken, getCardList);
APIs.get("/CardDetailList", checkToken, getCardDetail);
APIs.get("/CreateDocument", checkToken, CreateDocument);
APIs.get("/WorkOrderStatus", checkToken, getWorkOrderStatus);
APIs.get("/WorkOrderNames", checkToken, getWorkOrderNames);

module.exports = APIs;
