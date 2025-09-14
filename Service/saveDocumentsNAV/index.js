const { sql, poolPromise } = require("../../config/db");
const {
  formatToISO,
  getTodayISO,
  toThaiDate,
} = require("../../utils/dateFormatter");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const {
  getCardDetailListNAV,
  sendIStockStaging,
  getCardListNAV,
} = require("../NAV");
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
    const paramsgetDocNAV = `branchCode eq '${branchCode}' and docNo eq '${docNo}'`;
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
      await sendIStockStaging(params);
    }
    const lineFilter = products
      .map((p) => `lineNo eq ${p.lineNo}`)
      .join(" or ");

    const filter = `$filter=docNo eq '${docNo}' and (${lineFilter})`;

    const navDataDetail = await getCardDetailListNAV({
      menuId: 0,
      isEditFiler: true,
      filter: filter,
    });
    let _products = navDataDetail.map((v) => {
      const found = products.find((x) => x.lineNo === v.lineNo);

      return {
        ...v,
        docNo: v.itemNo,
        productCode: v.itemNo,
        model: v.variantCode,
        serialNo: found.serialNo ?? "",
        remark: v.description ?? "",
        quantity: found ? Number(found.quantity) : 0,
      };
    });

    const navData = await getCardListNAV({
      menuId: 0,
      branchCode: paramsgetDocNAV,
    });

    const _navData = navData[0];
    const c = {
      docNo: _navData.docNo,
      menuId: 0,
      menuName: "Scan-Receive",
      branchCode: _navData.branchCode,
      stockOutDate: toThaiDate(_navData.shipmentDate),
      remark: _navData.remark,
      locationCodeFrom: _navData.transferFromCode,
      binCodeFrom: "",
      locationCodeTo: "",
      binCodeTo: "",
      createdAt: formatToISO(new Date()),
      createdBy: username,
      status: _navData.status,
      products: _products,
    };
    return responseSuccess(res, "save Documents NAV", c);
  } catch (err) {
    console.error("Error save Documents NAV:", err);
    return responseError(res, "Internal server error", 500);
  }
};

module.exports = { saveDocumentsNAV, toThaiDate };
