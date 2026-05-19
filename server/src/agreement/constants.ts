/** Word 模板中可用的占位符（docxtemplater 语法：{key}） */
export const AGREEMENT_PLACEHOLDERS = [
  { key: "enterprise_name", label: "企业名称", source: "协议申请填写" },
  { key: "amount", label: "金额", source: "协议申请填写" },
  { key: "amount_cn", label: "金额（大写）", source: "由 amount 自动生成" },
  { key: "service_start", label: "服务开始日期", source: "协议申请填写（YYYY-MM-DD）" },
  { key: "service_end", label: "服务结束日期", source: "协议申请填写（YYYY-MM-DD）" },
  { key: "legal_name", label: "法人姓名", source: "挂靠材料" },
  { key: "legal_phone", label: "法人手机", source: "挂靠材料" },
  { key: "legal_contact_address", label: "法人联系地址", source: "挂靠材料" },
  { key: "legal_email", label: "法人邮箱", source: "挂靠材料" },
  { key: "applicant_name", label: "申请人", source: "挂靠申请" },
  { key: "group_name", label: "群名称", source: "挂靠申请" },
  { key: "address_type_label", label: "地址类型", source: "挂靠/地址库" },
  { key: "address_region", label: "地址区域", source: "挂靠/地址库" },
  { key: "detail_address", label: "详细地址", source: "审批通过后分配" },
  { key: "service_type", label: "服务类型", source: "挂靠申请" },
  { key: "today", label: "生成日期", source: "生成 PDF 当日" },
  { key: "agreement_no", label: "协议编号", source: "挂靠申请 ID 简写" },
] as const;

export type AgreementStatus = "none" | "pending" | "pdf_ready" | "completed" | "rejected";

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  none: "未申请协议",
  pending: "协议待审",
  pdf_ready: "待回传盖章协议",
  completed: "协议已完成",
  rejected: "协议已驳回",
};
