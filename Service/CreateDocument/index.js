const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const CreateDocument = async (req, res) => {
  try {
    const { menuType } = req.body; // ✅ แก้ตรงนี้

    if (!menuType) {
      return responseError(res, "menu type is required");
    }

    // 📝 สร้าง docId ตาม timestamp หรือ logic ที่เหมาะสม
    const now = new Date();
    const docId = `GRI${now.getFullYear().toString().slice(2)}${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}${now
      .getDate()
      .toString()
      .padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const newDocument = {
      docId,
      menuType,
      createdAt: now.toISOString(),
      status: "Open",
      products: [],
    };

    return responseSuccess(res, "Document created successfully", newDocument);
  } catch (error) {
    return responseError(res, "Failed to create document", error.message);
  }
};

module.exports = {
  CreateDocument,
};
