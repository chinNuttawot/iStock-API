const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { cardData } = require("./mockup");
const { getCardListNAV } = require("../NAV");

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getMenuType(menuId) {
  switch (Number(menuId)) {
    case 0:
      return "สแกนรับ";
    case 1:
      return "สแกนออก";
    case 2:
      return "สแกนโอนย้าย";
    case 3:
      return "สแกนตรวจนับ";
    default:
      return "ไม่ทราบประเภท";
  }
}

const getCardList = async (req, res) => {
  try {
    let { menuId, branchCode } = req.query;
    const isApprover = req.query.isApprover === "true" ?? false;
    menuId = Number(menuId);
    if (isNaN(menuId)) {
      return responseError(res, "Failed to menuId", 401);
    }
    if ([1, 2, 3, 4].includes(menuId)) {
      return responseError(res, "Failed to menuId", 401);
    }

    if (!branchCode) {
      return responseError(res, "Failed to branchCode", 401);
    }

    let _branchCode = `branchCode eq '${branchCode}'`;

    if (isApprover) {
      const branches = branchCode
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      _branchCode = branches.map((b) => `branchCode eq '${b}'`).join(" or ");
    }

    const navData = await getCardListNAV({ menuId, branchCode: _branchCode });
    const formatted = navData.map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(menuId),
      status: item.status,
      branchCode: item.branchCode,
      details: [
        { label: "วันที่ส่งสินค้า", value: formatDate(item.shipmentDate) },
        {
          label: "ส่งจากคลัง",
          value: `${item.transferFromCode}`,
        },
        { label: "E-Shop No.", value: item.eShopNo || "-" },
        { label: "หมายเหตุ", value: item.remark || "-" },
      ],
    }));

    return responseSuccess(res, "Card list fetched", formatted);
  } catch (error) {
    console.log("error ====>", error);

    return responseError(res, "Failed to get card list");
  }
};

module.exports = {
  getCardList,
  getMenuType,
  formatDate,
};
