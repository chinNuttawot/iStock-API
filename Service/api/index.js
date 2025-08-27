// routes/APIs.js
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
const { checkToken } = require("../../middleware/checkToken");
const { TestAPI } = require("../Test");
const { deleteAccount } = require("../DeleteAccount");
const { getOrderStatusList } = require("../OrderStatusList");
const { getBinCodesByLocation } = require("../BinCodesByLocation");
const { getLocations } = require("../Locations");

const {
  getHealth,
  uploadImage,
  uploadFile,
  uploadMultiple,
  listUploadedFiles,
  deleteFile,
} = require("../upload");

const {
  uploadImageSingle,
  uploadFileSingle,
  uploadMulti,
} = require("../../middleware/upload");
const { CreateDocumentFlowSave } = require("../CreateDocumentFlowSave");

const APIs = express.Router();

// ===== Public (ไม่ต้องเช็ค token) =====
APIs.post("/Login", Login);
APIs.post("/Register", Register);
APIs.get("/upload", getHealth); // health check ของ upload

// ===== Protected (ต้องเช็ค token) =====
// ตัวอย่าง test endpoint
APIs.post("/", checkToken, TestAPI);
APIs.get("/", checkToken, TestAPI);

// Auth/session
APIs.post("/Logout", checkToken, Logout);
APIs.post("/DeleteAccount", checkToken, deleteAccount);

// Data endpoints
APIs.get("/BinCodesByLocation", checkToken, getBinCodesByLocation);
APIs.get("/Locations", checkToken, getLocations);
APIs.get("/OrderStatusList", checkToken, getOrderStatusList);
APIs.get("/Profile", checkToken, GetProfile);
APIs.get("/Menus", checkToken, getMenus);
APIs.get("/Dashboard", checkToken, getDashboard);
APIs.get("/CardList", checkToken, getCardList);
APIs.get("/CardDetailList", checkToken, getCardDetail);
APIs.get("/CreateDocument", checkToken, CreateDocument);

// ===== Upload endpoints (สำคัญ: checkToken ต้องมาก่อน multer) =====
APIs.post("/upload/image", checkToken, uploadImageSingle, uploadImage);
APIs.post("/upload/file", checkToken, uploadFileSingle, uploadFile);
APIs.post("/upload/multi", checkToken, uploadMulti, uploadMultiple);

APIs.post("/CreateDocument", checkToken, CreateDocumentFlowSave);

// Files management
APIs.get("/files-list", checkToken, listUploadedFiles);
APIs.delete("/files/:name", checkToken, deleteFile);

module.exports = APIs;
