const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { cardData } = require("./mockup");

const getCardList = async (req, res) => {
  try {
    const { menuId, menuType, status, dateTime } = req.query;
    console.log("menuId ====>", menuId);
    return responseSuccess(res, "Card list fetched", cardData);
  } catch (error) {
    return responseError(res, "Failed to get card list", error.message);
  }
};

module.exports = {
  getCardList,
};
