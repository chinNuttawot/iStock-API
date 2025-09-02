const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { getItemWS } = require("../NAV");

const getItemProduct = async (req, res) => {
  try {
    let { itemNo, branchCode } = req.query;
    if (!itemNo) {
      return responseError(res, "Failed to itemNo", 401);
    }
    if (!branchCode) {
      return responseError(res, "Failed to branchCode", 401);
    }

    const navData = await getItemWS({ itemNo, branchCode });
    const formatted = navData.map((item, idx) => ({
      description: item.description,
      qtyShipped: item.inventory,
      picURL: item.picURL,
    }));

    return responseSuccess(res, "get Item Product fetched", formatted);
  } catch (error) {
    return responseError(res, "Failed to get Item Product");
  }
};

module.exports = {
  getItemProduct,
};
