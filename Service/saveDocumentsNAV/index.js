const { sql, poolPromise } = require("../../config/db");
const { formatToISO, getTodayISO } = require("../../utils/dateFormatter");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { getCardDetailListNAV, sendIStockStaging } = require("../NAV");
const { v4: uuidv4 } = require("uuid");

const saveDocumentsNAV = async (req, res) => {
  try {
    const { docNo, products, username, branchCode, binCode } = req.body;
    if (!docNo) {
      return responseError(res, "docNo not found", 401);
    }
    if (products.length === 0) {
      return responseError(res, "products not found", 401);
    }
    if (!username) {
      return responseError(res, "username not found", 401);
    }
    if (!branchCode) {
      return responseError(res, "branchCode not found", 401);
    }

    for (const p of products) {
      const params = {
        docNo: docNo,
        docLineNo: Number(p.lineNo),
        menuID: 0,
        menuName: "Scan-Receive",
        stockOutDate: getTodayISO(),
        remark: "",
        locationCodeFrom: "",
        binCodeFrom: "",
        createdAt: formatToISO(new Date()),
        createdBy: username,
        status: "Open",
        locationCodeTo: branchCode,
        binCodeTo: binCode ?? "",
        uuid: uuidv4(),
        model: p.model,
        quantity: Number(p.quantity),
        serialNo: p.serialNo,
        remarkProduct: "Save By iStock Mobile",
      };
      console.log("params : sendIStockStaging ==>", params);
      const res = await sendIStockStaging(params);
      console.log("res : sendIStockStaging ==>", res);
    }
    return responseSuccess(res, "save Documents NAV");
  } catch (err) {
    console.error("Error save Documents NAV:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { saveDocumentsNAV };
