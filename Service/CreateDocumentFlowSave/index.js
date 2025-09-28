const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { sql, poolPromise } = require("../../config/db");

/** แปลงวันที่ไทยรูปแบบ DD/MM/YYYY (พ.ศ.) -> Date (ค.ศ.) */
function parseThaiDateToJSDate(ddmmyyyy_thai) {
  if (!ddmmyyyy_thai) return null;
  // "28/08/2568" => [28,08,2568]
  const [dd, mm, yyyyThai] = ddmmyyyy_thai
    .split("/")
    .map((v) => parseInt(v, 10));
  if (!dd || !mm || !yyyyThai) return null;
  const yyyy = yyyyThai - 543; // แปลง พ.ศ. -> ค.ศ.
  // สร้าง Date แบบ UTC เพื่อลดความเสี่ยง time-zone
  return new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
}

const CreateDocumentFlowSave = async (req, res) => {
  const body = req.body || {};
  const {
    docNo,
    menuId,
    menuName,
    stockOutDate,
    remark,
    locationCodeFrom,
    binCodeFrom,
    locationCodeTo = null,
    binCodeTo = null,
    createdAt,
    createdBy,
    status,
    products = [],
    branchCode,
  } = body;

  if (!branchCode) return responseError(res, "branchCode is required", 400);
  if (!docNo) return responseError(res, "docNo is required", 400);
  if (!Array.isArray(products) || products.length === 0) {
    return responseError(res, "products must be a non-empty array", 400);
  }

  // เตรียมค่าที่จะบันทึก
  const stockOutDateJS = parseThaiDateToJSDate(stockOutDate); // DD/MM/พ.ศ.
  console.log("stockOutDateJS ====>", stockOutDateJS);
  
  const createdAtJS = createdAt ? new Date(createdAt) : new Date();

  try {
    const pool = await poolPromise;
    const tx = new sql.Transaction(pool);
    await tx.begin();

    // 1) ตรวจว่ามี docNo นี้แล้วหรือยัง
    const checkReq = new sql.Request(tx);
    const check = await checkReq
      .input("docNo", sql.VarChar(50), docNo)
      .query(`SELECT 1 AS ok FROM [Documents iStock] WHERE docNo = @docNo`);

    if (check.recordset && check.recordset.length > 0) {
      await tx.rollback();
      return responseError(res, `Document ${docNo} already exists`, 409);
    }

    // 2) Insert Header -> [Documents iStock]
    const headerReq = new sql.Request(tx);
    await headerReq
      .input("docNo", sql.VarChar(50), docNo)
      .input("menuId", sql.Int, menuId ?? null)
      .input("menuName", sql.NVarChar(100), menuName ?? null)
      .input("stockOutDate", sql.Date, stockOutDateJS ?? null)
      .input("remark", sql.NVarChar(255), remark ?? null)
      .input("locationCodeFrom", sql.NVarChar(50), locationCodeFrom ?? null)
      .input("binCodeFrom", sql.NVarChar(50), binCodeFrom ?? null)
      .input("createdAt", sql.DateTime2, createdAtJS)
      .input("createdBy", sql.NVarChar(50), createdBy ?? null)
      .input("status", sql.NVarChar(50), status ?? null)
      .input("locationCodeTo", sql.NVarChar(50), locationCodeTo ?? null)
      .input("binCodeTo", sql.NVarChar(50), binCodeTo ?? null)
      .input("branchCode", sql.NVarChar(50), branchCode ?? null).query(`
        INSERT INTO [Documents iStock] 
        (docNo, menuId, menuName, stockOutDate, remark, locationCodeFrom, binCodeFrom, createdAt, createdBy, status, locationCodeTo, binCodeTo, branchCode)
        VALUES
        (@docNo, @menuId, @menuName, @stockOutDate, @remark, @locationCodeFrom, @binCodeFrom, @createdAt, @createdBy, @status, @locationCodeTo, @binCodeTo, @branchCode)
      `);

    // 3) Insert Detail(s) -> [DocumentProducts iStock]
    for (const p of products) {
      const {
        productCode,
        model,
        quantity,
        serialNo,
        remark: itemRemark,
        uuid,
        picURL,
      } = p;

      const qtyNum =
        typeof quantity === "number"
          ? quantity
          : Number(String(quantity || "0").replace(/,/g, ""));

      const detailReq = new sql.Request(tx);
      await detailReq
        .input("docNo", sql.VarChar(50), docNo)
        .input("uuid", sql.UniqueIdentifier, uuid || sql.VarChar) // ถ้า client ส่ง uuid ไม่ได้เป็น GUID ให้ลบคอลัมน์นี้ออกหรือแปลงฝั่ง client ให้เป็น GUID
        .input("productCode", sql.NVarChar(100), productCode ?? null)
        .input("model", sql.NVarChar(100), model ?? null)
        .input("quantity", sql.Decimal(18, 2), isNaN(qtyNum) ? 0 : qtyNum)
        .input("serialNo", sql.NVarChar(100), serialNo ?? null)
        .input("remark", sql.NVarChar(255), itemRemark ?? null)
        .input("branchCode", sql.NVarChar(50), branchCode ?? null)
        .input("picURL", sql.NVarChar(250), picURL ?? null).query(`
          INSERT INTO [DocumentProducts iStock]
          (docNo, uuid, productCode, model, quantity, serialNo, remark, branchCode, picURL)
          VALUES
          (@docNo, @uuid, @productCode, @model, @quantity, @serialNo, @remark, @branchCode, @picURL)
        `);
    }

    await tx.commit();

    return responseSuccess(res, "Create Document successfully", {
      docNo,
      insertedProducts: products.length,
    });
  } catch (error) {
    // rollback ถ้าเปิด transaction แล้ว
    try {
      // อาจ throw ถ้ายังไม่ begin หรือถูก rollback ไปแล้ว
      const pool = await poolPromise;
      const tx = new sql.Transaction(pool);
      if (tx._aborted !== true) await tx.rollback();
    } catch (_) {}

    return responseError(res, "Failed to create document");
  }
};

module.exports = {
  CreateDocumentFlowSave,
};
