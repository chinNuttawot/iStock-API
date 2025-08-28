const { poolPromise } = require("../../config/db");
const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");

const getMenuName = async (menuId) => {
  const pool = await poolPromise;
  const { recordset } = await pool.request().query(`
      SELECT [nameMenu]
      FROM [Menu iStock]
      WHERE [ID] = ${menuId};
    `);
  return recordset[0].nameMenu || "";
};

const CreateDocument = async (req, res) => {
  try {
    let { menuId } = req.query;
    if (menuId === undefined) {
      return responseError(res, "menuId is required", 400);
    }
    menuId = Number(menuId);
    if (Number.isNaN(menuId)) {
      return responseError(res, "menuId must be a number", 400);
    }
    if (menuId >= 4) {
      return responseError(res, "Menu not found", 404);
    }
    const typeMenu =
      menuId === 0 ? "MI" : menuId === 1 ? "MO" : menuId === 2 ? "MT" : "MC";
    const now = new Date();
    const docNo = `${typeMenu}-${now.getFullYear().toString().slice(2)}${(
      now.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}${now
      .getDate()
      .toString()
      .padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const menuName = await getMenuName(menuId);
    const newDocument = {
      docNo,
      menuId,
      menuName,
      stockOutDate: null,
      remark: null,
      locationCodeFrom: null,
      binCodeFrom: null,
      createdAt: now.toISOString(),
      createdBy: null,
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
  getMenuName,
};
