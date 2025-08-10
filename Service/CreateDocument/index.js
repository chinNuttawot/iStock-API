const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const CreateDocument = async (req, res) => {
  try {
    const { menuId } = req.body; // ✅ แก้ตรงนี้
    if (menuId === undefined) {
      return responseError(res, "menuId is required", 400);
    }

    if (typeof menuId !== "number" || Number.isNaN(menuId)) {
      return responseError(res, "menuId must be a number", 400);
    }

    if (menuId >= 4) {
      return responseError(res, "Menu not found", 404);
    }

    const typeMenu =
      menuId === 0 ? "MI" : menuId === 1 ? "MO" : menuId === 2 ? "MT" : "MC";
    const now = new Date();
    const docId = `${typeMenu}-${now.getFullYear().toString().slice(2)}${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}${now
      .getDate()
      .toString()
      .padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const newDocument = {
      docId,
      menuId,
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
