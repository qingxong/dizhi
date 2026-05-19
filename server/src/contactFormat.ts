/** 挂靠材料：手机号、身份证号、邮箱格式校验 */

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "").replace(/^(\+86|0086)/i, "");
}

/** 中国大陆手机号或常见固话（区号+号码） */
export function isValidCnPhone(raw: string): boolean {
  const p = normalizePhone(raw);
  if (/^1[3-9]\d{9}$/.test(p)) return true;
  if (/^0\d{9,11}$/.test(p)) return true;
  return false;
}

export function isValidEmail(raw: string): boolean {
  const e = raw.trim();
  if (!e || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** 18 位居民身份证（含校验位） */
export function isValidCnIdCard(raw: string): boolean {
  const id = raw.trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(id)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = "10X98765432";
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += Number(id[i]) * weights[i]!;
  }
  return checkCodes[sum % 11] === id[17];
}

type MaterialRow = Record<string, unknown>;

/** 提交审批前格式校验；返回首个错误文案 */
export function validateAffiliationMaterialFormats(row: MaterialRow): string | null {
  const ct = row.contact_type === "channel" ? "channel" : "direct";

  if (ct === "channel") {
    const chPhones: [string, string][] = [
      ["渠道常用联系人电话", String(row.channel_common_contact_phone ?? "")],
      ["渠道备用联系人电话", String(row.channel_backup_contact_phone ?? "")],
    ];
    for (const [label, phone] of chPhones) {
      if (phone.trim() && !isValidCnPhone(phone)) {
        return `${label}格式不正确，请填写11位手机号或有效固话`;
      }
    }
  }

  const legalPhone = String(row.legal_phone ?? "");
  if (legalPhone.trim() && !isValidCnPhone(legalPhone)) {
    return "法人手机号格式不正确，请填写11位手机号或有效固话";
  }

  const backupPhone = String(row.enterprise_backup_phone ?? "");
  if (backupPhone.trim() && !isValidCnPhone(backupPhone)) {
    return "企业备用联系人电话格式不正确，请填写11位手机号或有效固话";
  }

  const email = String(row.legal_email ?? "");
  if (email.trim() && !isValidEmail(email)) {
    return "法人邮箱格式不正确";
  }

  const idNo = String(row.legal_id_number ?? "");
  if (idNo.trim() && !isValidCnIdCard(idNo)) {
    return "法人身份证号格式不正确，请填写18位有效身份证号码";
  }

  return null;
}
