/** 地址领取：联络人类型 + 材料清单（与《开发计划》一致） */

import { validateAffiliationMaterialFormats } from "./contactFormat.js";

export type ContactType = "channel" | "direct";

export const AFFILIATION_MATERIAL_COLUMNS = [
  "contact_type",
  "need_address_change",
  "channel_company_name",
  "channel_common_contact_name",
  "channel_common_contact_phone",
  "channel_backup_contact_name",
  "channel_backup_contact_phone",
  "legal_id_front",
  "legal_id_back",
  "legal_name",
  "legal_id_number",
  "legal_phone",
  "legal_contact_address",
  "legal_email",
  "enterprise_backup_name",
  "enterprise_backup_phone",
  "license_photo",
] as const;

export type AffiliationMaterialColumn = (typeof AFFILIATION_MATERIAL_COLUMNS)[number];

export function materialFromBody(b: Record<string, unknown>): Record<AffiliationMaterialColumn, string | number | null> {
  const str = (k: string): string | null => {
    const v = b[k];
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  const ct: ContactType = b.contact_type === "channel" ? "channel" : "direct";
  const need =
    b.need_address_change === true ||
    b.need_address_change === 1 ||
    b.need_address_change === "1" ||
    b.need_address_change === "true"
      ? 1
      : 0;
  return {
    contact_type: ct,
    need_address_change: need,
    channel_company_name: str("channel_company_name"),
    channel_common_contact_name: str("channel_common_contact_name"),
    channel_common_contact_phone: str("channel_common_contact_phone"),
    channel_backup_contact_name: str("channel_backup_contact_name"),
    channel_backup_contact_phone: str("channel_backup_contact_phone"),
    legal_id_front: str("legal_id_front"),
    legal_id_back: str("legal_id_back"),
    legal_name: str("legal_name"),
    legal_id_number: (() => {
      const s = str("legal_id_number");
      return s ? s.toUpperCase() : null;
    })(),
    legal_phone: str("legal_phone"),
    legal_contact_address: str("legal_contact_address"),
    legal_email: str("legal_email"),
    enterprise_backup_name: str("enterprise_backup_name"),
    enterprise_backup_phone: str("enterprise_backup_phone"),
    license_photo: str("license_photo"),
  };
}

function nonempty(v: unknown): boolean {
  return v != null && String(v).trim() !== "";
}

/** 提交审批 / 重新提交 / 新建即 pending 前校验 */
export function validateAffiliationMaterial(row: Record<string, unknown>): string | null {
  const ct = row.contact_type === "channel" ? "channel" : "direct";

  if (ct === "channel") {
    if (!nonempty(row.channel_common_contact_name)) return "渠道材料：请填写渠道常用联系人姓名";
    if (!nonempty(row.channel_common_contact_phone)) return "渠道材料：请填写渠道常用联系人电话";
    if (!nonempty(row.channel_backup_contact_name)) return "渠道材料：请填写渠道备用联系人姓名";
    if (!nonempty(row.channel_backup_contact_phone)) return "渠道材料：请填写渠道备用联系人电话";
  }

  if (!nonempty(row.legal_id_front)) return "请上传企业法人身份证正面照片";
  if (!nonempty(row.legal_id_back)) return "请上传企业法人身份证反面照片";
  if (!nonempty(row.legal_name)) return "请填写企业法人姓名";
  if (!nonempty(row.legal_id_number)) return "请填写法人身份证号";
  if (!nonempty(row.legal_phone)) return "请填写企业法人手机号";
  if (!nonempty(row.legal_contact_address)) return "请填写企业法人联系地址";
  if (!nonempty(row.legal_email)) return "请填写企业法人邮箱";
  if (!nonempty(row.enterprise_backup_name)) return "请填写企业备用联系人姓名";
  if (!nonempty(row.enterprise_backup_phone)) return "请填写企业备用联系人电话";

  const need = row.need_address_change === 1 || row.need_address_change === true;
  if (need && !nonempty(row.license_photo)) {
    return "已选择用于办理地址变更：请上传执照照片";
  }

  return validateAffiliationMaterialFormats(row);
}

export function mergeMaterialIntoRow(base: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const m = materialFromBody(b);
  return { ...base, ...m };
}

/** PATCH：仅对请求体中出现的材料字段赋值 */
export function materialPatchFromBody(b: Record<string, unknown>): Partial<Record<AffiliationMaterialColumn, string | number | null>> {
  const patch: Partial<Record<AffiliationMaterialColumn, string | number | null>> = {};
  if (b.contact_type !== undefined) {
    patch.contact_type = b.contact_type === "channel" ? "channel" : "direct";
  }
  if (b.need_address_change !== undefined) {
    const v = b.need_address_change;
    patch.need_address_change =
      v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
  }
  const strCols: Exclude<AffiliationMaterialColumn, "contact_type" | "need_address_change">[] = [
    "channel_company_name",
    "channel_common_contact_name",
    "channel_common_contact_phone",
    "channel_backup_contact_name",
    "channel_backup_contact_phone",
    "legal_id_front",
    "legal_id_back",
    "legal_name",
    "legal_id_number",
    "legal_phone",
    "legal_contact_address",
    "legal_email",
    "enterprise_backup_name",
    "enterprise_backup_phone",
    "license_photo",
  ];
  for (const k of strCols) {
    if (b[k] !== undefined) {
      const v = b[k];
      if (v === null || v === "") {
        patch[k] = null;
      } else if (k === "legal_id_number") {
        patch[k] = String(v).trim().toUpperCase();
      } else {
        patch[k] = String(v).trim();
      }
    }
  }
  return patch;
}

export function applyMaterialPatchToRow(
  base: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  return { ...base, ...materialPatchFromBody(b) };
}
