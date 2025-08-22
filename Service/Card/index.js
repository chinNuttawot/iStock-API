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
    menuId = Number(menuId);
    if (isNaN(menuId)) {
      return responseError(res, "Failed to menuId", 400);
    }
    if (menuId >= 4) {
      return responseError(res, "Failed to menuId", 401);
    }
    if (menuId >= 1 && menuId <= 2) {
      return responseSuccess(res, "Card list fetched (ยังไม่พร้อมใช้งาน)", {});
    }
    const navData = await getCardListNAV({ menuId, branchCode });
    const formatted = navData.map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(menuId),
      status: item.status,
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
    return responseError(res, "Failed to get card list", error.message);
  }
};

module.exports = {
  getCardList,
};
