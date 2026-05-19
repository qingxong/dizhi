/** 与 server/src/contactFormat.ts 保持一致 */

export function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "").replace(/^(\+86|0086)/i, "");
}

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

export type MaterialFormLike = {
  contact_type: string;
  channel_common_contact_phone: string;
  channel_backup_contact_phone: string;
  legal_id_number: string;
  legal_phone: string;
  legal_email: string;
  enterprise_backup_phone: string;
};

export function validateMaterialFormFormats(
  m: MaterialFormLike,
  opts?: { requireIdNumber?: boolean },
): string | null {
  const ct = m.contact_type === "channel" ? "channel" : "direct";

  if (ct === "channel") {
    for (const [label, phone] of [
      ["渠道常用联系人电话", m.channel_common_contact_phone],
      ["渠道备用联系人电话", m.channel_backup_contact_phone],
    ] as const) {
      if (phone.trim() && !isValidCnPhone(phone)) {
        return `${label}格式不正确，请填写11位手机号或有效固话`;
      }
    }
  }

  if (m.legal_phone.trim() && !isValidCnPhone(m.legal_phone)) {
    return "法人手机号格式不正确，请填写11位手机号或有效固话";
  }
  if (m.enterprise_backup_phone.trim() && !isValidCnPhone(m.enterprise_backup_phone)) {
    return "企业备用联系人电话格式不正确，请填写11位手机号或有效固话";
  }
  if (m.legal_email.trim() && !isValidEmail(m.legal_email)) {
    return "法人邮箱格式不正确";
  }
  if (m.legal_id_number.trim()) {
    if (!isValidCnIdCard(m.legal_id_number)) {
      return "法人身份证号格式不正确，请填写18位有效身份证号码";
    }
  } else if (opts?.requireIdNumber) {
    return "请填写法人身份证号";
  }

  return null;
}
