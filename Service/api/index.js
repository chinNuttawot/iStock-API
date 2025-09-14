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
const {
  GetDocuments,
  GetDocumentProductsByDocNo,
  GetDocumentByDocNo,
  GetDocumentsByDocNos,
  ApproveDocuments,
  SendToApproveDocuments,
  GetDocumentByDocNoForTransactionHistory,
} = require("../Document");
const { DeleteDocumentProducts } = require("../DeleteDocumentProducts");
const { getItemVariant } = require("../ItemVariantWS");
const { getItemProduct } = require("../ItemProductWS");
const { GetBagNumber } = require("../Bagnumber");
const {
  CreateTransactionHistory,
  GetTransactionHistory,
} = require("../TransactionHistory");
const { ApproveDocumentsNAV } = require("../ApproveDocumentsNAV");
const { saveDocumentsNAV } = require("../saveDocumentsNAV");
const { ForgotPassword } = require("../ForgotPassword");

const APIs = express.Router();

APIs.post("/Login", Login);
APIs.post("/Register", Register);
APIs.get("/upload", getHealth);

APIs.post("/", checkToken, TestAPI);
APIs.get("/", checkToken, TestAPI);

APIs.post("/Logout", checkToken, Logout);
APIs.post("/DeleteAccount", checkToken, deleteAccount);

APIs.get("/BinCodesByLocation", getBinCodesByLocation);
APIs.get("/Locations", getLocations);
APIs.get("/OrderStatusList", checkToken, getOrderStatusList);
APIs.get("/Profile", checkToken, GetProfile);
APIs.get("/Menus", checkToken, getMenus);
APIs.get("/Dashboard", checkToken, getDashboard);
APIs.get("/CardList", checkToken, getCardList);
APIs.get("/CardDetailList", checkToken, getCardDetail);
APIs.get("/CreateDocument", checkToken, CreateDocument);
APIs.get("/documents", checkToken, GetDocuments);
APIs.get("/documents/:docNo/products", checkToken, GetDocumentProductsByDocNo);
APIs.get("/documents/:docNo", checkToken, GetDocumentByDocNo);
APIs.get(
  "/documents-for-transaction-history/:docNo",
  checkToken,
  GetDocumentByDocNoForTransactionHistory
);
APIs.get("/documents-send-NAV", checkToken, GetDocumentsByDocNos);
APIs.get("/ItemVariantWS", checkToken, getItemVariant);
APIs.get("/ItemProductWS", checkToken, getItemProduct);
APIs.get("/Bagnumber", checkToken, GetBagNumber);
APIs.get("/GetTransactionHistory", checkToken, GetTransactionHistory);

APIs.post("/upload/image", checkToken, uploadImageSingle, uploadImage);
APIs.post("/upload/file", checkToken, uploadFileSingle, uploadFile);
APIs.post("/upload/multi", checkToken, uploadMulti, uploadMultiple);
APIs.post("/CreateDocument", checkToken, CreateDocumentFlowSave);
APIs.post("/document-products-delete", checkToken, DeleteDocumentProducts);
APIs.post("/ApproveDocuments", checkToken, ApproveDocuments);
APIs.post("/SendToApproveDocuments", checkToken, SendToApproveDocuments);
APIs.post("/transaction-history", checkToken, CreateTransactionHistory);
APIs.post("/ApproveDocuments-NAV", checkToken, ApproveDocumentsNAV);
APIs.post("/saveDocuments-NAV", checkToken, saveDocumentsNAV);
APIs.post("/forgot-password", checkToken, ForgotPassword);

APIs.get("/files-list", checkToken, listUploadedFiles);
APIs.delete("/files/:name", checkToken, deleteFile);

module.exports = APIs;
