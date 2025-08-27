const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const CreateDocumentFlowSave = async (req, res) => {
  try {
    console.log("req ====>", req.body);

    return responseSuccess(res, "Create Document successfully");
  } catch (error) {
    return responseError(res, "Failed to create document", error.message);
  }
};

module.exports = {
  CreateDocumentFlowSave,
};
