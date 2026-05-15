export type UserRole = "admin" | "sales";

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
}

/** 管理员用户列表（无密码字段） */
export interface ManagedUser {
  id: string;
  username: string;
  role: UserRole;
  display_name: string;
  created_at: string;
}

export type AddressType = "affiliation" | "coworking" | "business_secretary";

export const ADDRESS_TYPE_LABELS: Record<AddressType, string> = {
  affiliation: "地址挂靠",
  coworking: "集中办公区",
  business_secretary: "商务秘书",
};

/** 挂靠申请「服务类型」下拉选项（与地址类型中文名称一致） */
export const AFFILIATION_SERVICE_TYPES = [
  ADDRESS_TYPE_LABELS.affiliation,
  ADDRESS_TYPE_LABELS.coworking,
  ADDRESS_TYPE_LABELS.business_secretary,
] as const;

export type AffiliationServiceTypeLabel = (typeof AFFILIATION_SERVICE_TYPES)[number];

export interface Address {
  id: string;
  address_type: AddressType;
  address_region: string;
  detail_address: string;
  created_at: string;
  updated_at: string;
}

/** 挂靠建单等场景下的地址选项（与 Address 字段一致，只读） */
export type AddressChoice = Pick<Address, "id" | "address_type" | "address_region" | "detail_address">;

export type AffiliationStatus = "draft" | "pending" | "approved" | "rejected";

export type AffiliationContactType = "channel" | "direct";

export interface AffiliationRequest {
  id: string;
  address_id: string;
  applicant_name: string;
  /** 已废弃展示；新申请存空字符串，历史数据可能仍有值 */
  applicant_dept: string;
  service_type: string;
  status: AffiliationStatus;
  notes: string | null;
  reviewer_name: string | null;
  review_comment: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  address_type: AddressType;
  address_region: string;
  detail_address: string;
  /** 联络人类型：渠道 / 直客 */
  contact_type: AffiliationContactType;
  /** 是否办理地址变更（需执照照片） */
  need_address_change: number;
  channel_common_contact_name: string | null;
  channel_common_contact_phone: string | null;
  channel_backup_contact_name: string | null;
  channel_backup_contact_phone: string | null;
  /** 正面照片：上传后的访问路径（如 /api/uploads/xxx.jpg） */
  legal_id_front: string | null;
  /** 反面照片：上传后的访问路径（如 /api/uploads/xxx.jpg） */
  legal_id_back: string | null;
  legal_name: string | null;
  legal_phone: string | null;
  legal_contact_address: string | null;
  legal_email: string | null;
  enterprise_backup_name: string | null;
  enterprise_backup_phone: string | null;
  /** 执照照片：上传后的访问路径（如 /api/uploads/xxx.jpg） */
  license_photo: string | null;
  /** 创建人用户 id；业务员仅可操作本人记录 */
  created_by_user_id?: string | null;
}

export interface StatsResponse {
  /** 为 true 时含全平台地址统计；业务员为 false，仅含本人挂靠统计 */
  platformAddressStats?: boolean;
  totalAddresses: number;
  pendingApprovals: number;
  addressesByType: Record<string, number>;
  affiliationsByStatus: Record<string, number>;
  newAddressesLast12Months: { month: string; count: number }[];
}
