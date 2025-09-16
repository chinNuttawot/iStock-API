const {
  responseSuccess,
  responseError,
} = require("../../utils/responseHelper");
const { cardData } = require("./mockup");
const { getCardListNAV } = require("../NAV");

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getMenuType(menuId) {
  switch (Number(menuId)) {
    case 0:
      return "สแกนรับ";
    case 1:
      return "สแกนออก";
    case 2:
      return "สแกนโอนย้าย";
    case 3:
      return "สแกนตรวจนับ";
    default:
      return "ไม่ทราบประเภท";
  }
}

const odataQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

const getCardList = async (req, res) => {
  try {
    let { menuId, branchCode, status, stockOutDate, docNo } = req.query;
    const isApprover = req.query.isApprover === "true" ?? false;
    menuId = Number(menuId);
    if (isNaN(menuId)) {
      return responseError(res, "Failed to menuId", 401);
    }
    if ([1, 2, 3, 4].includes(menuId)) {
      return responseError(res, "Failed to menuId", 401);
    }

    if (!branchCode) {
      return responseError(res, "Failed to branchCode", 401);
    }

    let _branchCode = `branchCode eq '${branchCode}'`;

    if (isApprover) {
      let _Status = [];
      if (status) {
        if (status === "All") {
          _Status = "Pending Approval|Approved|Rejected"
            .split("|")
            .map((b) => b.trim())
            .filter(Boolean);
        } else {
          _Status = status
            .split("|")
            .map((b) => b.trim())
            .filter(Boolean);
        }
      }

      const branches = branchCode
        .split("|")
        .map((b) => b.trim())
        .filter(Boolean);
      const branchExpr = branches.length
        ? `(${branches
            .map((b) => `branchCode eq ${odataQuote(b)}`)
            .join(" or ")})`
        : "";

      const statusExpr =
        _Status.length > 0
          ? `(${_Status.map((s) => `status eq ${odataQuote(s)}`).join(" or ")})`
          : "";

      _branchCode = [branchExpr, statusExpr].filter(Boolean).join(" and ");
    } else {
      if (status) {
        const statusExpr = `status eq ${status}`;
        _branchCode = [statusExpr].filter(Boolean).join(" and ");
      }
    }

    if (stockOutDate) {
      const _stockOutDate = `shipmentDate eq ${stockOutDate}`;
      _branchCode = [_stockOutDate].filter(Boolean).join(" and ");
    }

    if (docNo) {
      const _docNo = `contains(docNo,'${docNo}')`;
      _branchCode = [_docNo].filter(Boolean).join(" and ");
    }

    const navData = await getCardListNAV({ menuId, branchCode: _branchCode });
    const formatted = navData.map((item, idx) => ({
      id: String(idx + 1),
      docNo: item.docNo,
      menuType: getMenuType(menuId),
      status: item.status,
      branchCode: item.branchCode,
      date: `สร้างวันที่ ${formatDateTime(item.shipmentDate)}`,
      details: [
        { label: "วันที่ส่งสินค้า", value: formatDate(item.shipmentDate) },
        {
          label: "ส่งจากคลัง",
          value: `${item.transferFromCode}`,
        },
        { label: "E-Shop No.", value: item.eShopNo || "-" },
        { label: "หมายเหตุ", value: item.remark || "-" },
      ],
    }));

    return responseSuccess(res, "Card list fetched", formatted);
  } catch (error) {
    console.error("error ====>", error);

    return responseError(res, "Failed to get card list");
  }
};

module.exports = {
  getCardList,
  getMenuType,
  formatDate,
  formatDateTime,
};
