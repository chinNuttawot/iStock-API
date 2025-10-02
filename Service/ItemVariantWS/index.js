const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { getItemVariantWS } = require("../NAV");

const getItemVariant = async (req, res) => {
  try {
    let { itemNo } = req.query;

    if (!itemNo) {
      return responseError(res, "Failed to itemNo", 401);
    }

    const navData = await getItemVariantWS({ itemNo });
    const formatted = navData.map((item, idx) => ({
      value: item.variantCode,
      key: item.variantCode,
      picURL: item.picURL,
      description: item.description || "ไม่มีชื่อสินค้า",
    }));

    return responseSuccess(res, "get Item Variant fetched", formatted);
  } catch (error) {
    return responseError(res, "Failed to get Item Variant");
  }
};

module.exports = {
  getItemVariant,
};
