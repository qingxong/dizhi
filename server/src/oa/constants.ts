/** OA 客户信息表单（entry 56ac09c06e2dd06a08f7ed6c）字段别名 */
export const OA = {
  BASE_URL: process.env.OA_API_BASE_URL || "https://wx.hnzhcyy.cn",
  APP_ID: process.env.OA_APP_ID || "50cf5a8c1217c1b137c55032",
  ENTRY_ID: process.env.OA_CUSTOMER_ENTRY_ID || "56ac09c06e2dd06a08f7ed6c",
  FIELDS: {
    customerName: "_widget_1697441011116",
    contactsSubform: "_widget_1770291560898",
    contactName: "_widget_1770291560923",
    contactMethodType: "_widget_1770291560978",
    contactMethod: "_widget_1770291561102",
    customerType: "_widget_1697441011400",
    salesOwner: "_widget_1697441012855",
    customerSn: "_widget_1697442470135",
    /** 历史主表联系人字段（子表单为空时 OA 列表仍可能展示此处电话） */
    legacyContactName: "_widget_1745573690580",
    legacyContactType: "_widget_1697441011488",
    legacyContact: "_widget_1697441011506",
  },
  QUERY_FIELDS: [
    "_widget_1697441011116",
    "_widget_1770291560898",
    "_widget_1745573690580",
    "_widget_1697441011488",
    "_widget_1697441011506",
    "_widget_1697441011400",
    "_widget_1697441012855",
    "_widget_1697442470135",
    "updateTime",
  ],
} as const;

export const OA_CUSTOMER_TYPE_DIRECT = "直客";
export const OA_CUSTOMER_TYPE_CHANNEL = "渠道";
export const OA_CONTACT_METHOD_PHONE = "电话";
