const cardData = [
  {
    id: "1",
    docId: "TRO2506-079",
    menuType: "สแกนรับ",
    status: "Open",
    details: [
      { label: "วันที่ส่งสินค้า", value: "23/06/2025" },
      { label: "ส่งจากคลัง", value: "00HO - Head Office" },
      { label: "E-Shop No.", value: "PRE2309023" },
      { label: "หมายเหตุ", value: "Operation Group สำหรับ Jubu Jibi" },
    ],
  },
  {
    id: "2",
    docId: "TRO2506-080",
    menuType: "สแกนรับ",
    status: "Approved",
    details: [
      { label: "วันที่ส่งสินค้า", value: "24/06/2025" },
      { label: "ส่งจากคลัง", value: "00HO - Head Office" },
      { label: "E-Shop No.", value: "PRE2309024" },
      { label: "หมายเหตุ", value: "Operation Group สำหรับ AAA" },
    ],
  },
  {
    id: "3",
    docId: "TRO2506-010",
    menuType: "สแกนรับ",
    status: "Pending Approval",
    details: [],
  },
  {
    id: "4",
    docId: "TRO2506-011",
    menuType: "สแกนรับ",
    status: "Rejected",
    details: [],
  },
];

module.exports = {
  cardData,
};
