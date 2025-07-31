const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const TestAPI = async (req, res) => {
  try {
    return responseSuccess(res, "Test API", {}, 200);
  } catch (err) {
    console.error("GetProfile error:", err);
    return responseError(res, "Server error", 500);
  }
};

module.exports = { TestAPI };
