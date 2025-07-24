const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { productData } = require("./mockup");

const getCardDetail = async (req, res) => {
  try {
    const { docId } = req.query;

    return responseSuccess(res, "Card detail fetched", productData);
  } catch (error) {
    return responseError(res, "Failed to get card detail", error.message);
  }
};

module.exports = {
  getCardDetail,
};
