const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { getCardDetailListNAV } = require("../NAV");
const { productData } = require("./mockup");

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

const getCardDetail = async (req, res) => {
  try {
    let { menuId, docNo } = req.query;
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
    const navData = await getCardDetailListNAV({ menuId, docNo });
    const formatted = navData.map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(menuId),
      model: "",
      qtyReceived: item.qtyReceived,
      qtyShipped: item.qtyShipped,
      isDelete: false,
      details: [
        { label: "รุ่น", value: "-" },
        { label: "หมายเหตุ", value: item.description ?? "" },
        {
          label: "คงเหลือ",
          value:
            item.qtyReceived === 0
              ? item.qtyShipped
              : item.qtyReceived - item.qtyShipped,
        },
      ],
      image: "",
    }));

    return responseSuccess(res, "Card Detail list fetched", formatted);
  } catch (error) {
    return responseError(res, "Failed to get card detail", error.message);
  }
};

module.exports = {
  getCardDetail,
};
