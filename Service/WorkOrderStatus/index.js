const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { statusOptions } = require("./mockup");

const getWorkOrderStatus = async (req, res) => {
  try {
    return responseSuccess(res, "Status options fetched", statusOptions);
  } catch (error) {
    return responseError(res, "Failed to fetch status options", error.message);
  }
};

module.exports = {
  getWorkOrderStatus,
};
