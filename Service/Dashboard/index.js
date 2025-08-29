const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { dashboardData } = require("./mockup");

const getDashboard = async (req, res) => {
  try {
    return responseSuccess(res, "Dashboard data fetched", dashboardData);
  } catch (error) {
    return responseError(res, "Failed to get dashboard data");
  }
};

module.exports = {
  getDashboard,
};
