const { revokedTokens } = require("../../middleware/checkToken");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const Logout = (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (token) {
    revokedTokens.add(token);
    return responseSuccess(res, "Logged out and token revoked.");
  }

  return responseError(res, "No token provided", 400);
};

module.exports = { Logout };
