import type { AffiliationContactType, Customer, CustomerType } from "../types";

/** 挂靠材料表单中可由客户档案带出的文字字段 */
export type CustomerMaterialTextPatch = {
  contact_type: AffiliationContactType;
  channel_company_name?: string;
  channel_common_contact_name?: string;
  channel_common_contact_phone?: string;
  channel_backup_contact_name?: string;
  channel_backup_contact_phone?: string;
  legal_name?: string;
  legal_id_number?: string;
  legal_phone?: string;
  legal_contact_address?: string;
  legal_email?: string;
  enterprise_backup_name?: string;
  enterprise_backup_phone?: string;
};

function orEmpty(v: string | null | undefined): string {
  return v?.trim() ? v.trim() : "";
}

export function customerToMaterialPatch(c: Customer): CustomerMaterialTextPatch {
  if (c.customer_type === "channel") {
    return {
      contact_type: "channel",
      channel_company_name: orEmpty(c.channel_company_name),
      channel_common_contact_name: orEmpty(c.channel_common_contact_name),
      channel_common_contact_phone: orEmpty(c.channel_common_contact_phone),
      channel_backup_contact_name: orEmpty(c.channel_backup_contact_name),
      channel_backup_contact_phone: orEmpty(c.channel_backup_contact_phone),
    };
  }
  return {
    contact_type: "direct",
    legal_name: orEmpty(c.legal_name),
    legal_id_number: orEmpty(c.legal_id_number),
    legal_phone: orEmpty(c.legal_phone),
    legal_contact_address: orEmpty(c.legal_contact_address),
    legal_email: orEmpty(c.legal_email),
    enterprise_backup_name: orEmpty(c.enterprise_backup_name),
    enterprise_backup_phone: orEmpty(c.enterprise_backup_phone),
  };
}

export type CustomerFormState = {
  customer_type: CustomerType;
  channel_company_name: string;
  channel_common_contact_name: string;
  channel_common_contact_phone: string;
  channel_backup_contact_name: string;
  channel_backup_contact_phone: string;
  legal_name: string;
  legal_id_number: string;
  legal_phone: string;
  legal_contact_address: string;
  legal_email: string;
  enterprise_backup_name: string;
  enterprise_backup_phone: string;
};

export function emptyCustomerForm(type: CustomerType = "direct"): CustomerFormState {
  return {
    customer_type: type,
    channel_company_name: "",
    channel_common_contact_name: "",
    channel_common_contact_phone: "",
    channel_backup_contact_name: "",
    channel_backup_contact_phone: "",
    legal_name: "",
    legal_id_number: "",
    legal_phone: "",
    legal_contact_address: "",
    legal_email: "",
    enterprise_backup_name: "",
    enterprise_backup_phone: "",
  };
}

export function customerToForm(c: Customer): CustomerFormState {
  return {
    customer_type: c.customer_type,
    channel_company_name: c.channel_company_name ?? "",
    channel_common_contact_name: c.channel_common_contact_name ?? "",
    channel_common_contact_phone: c.channel_common_contact_phone ?? "",
    channel_backup_contact_name: c.channel_backup_contact_name ?? "",
    channel_backup_contact_phone: c.channel_backup_contact_phone ?? "",
    legal_name: c.legal_name ?? "",
    legal_id_number: c.legal_id_number ?? "",
    legal_phone: c.legal_phone ?? "",
    legal_contact_address: c.legal_contact_address ?? "",
    legal_email: c.legal_email ?? "",
    enterprise_backup_name: c.enterprise_backup_name ?? "",
    enterprise_backup_phone: c.enterprise_backup_phone ?? "",
  };
}

export function customerFormToApiBody(f: CustomerFormState): Record<string, unknown> {
  return {
    customer_type: f.customer_type,
    channel_company_name: f.channel_company_name.trim() || null,
    channel_common_contact_name: f.channel_common_contact_name.trim() || null,
    channel_common_contact_phone: f.channel_common_contact_phone.trim() || null,
    channel_backup_contact_name: f.channel_backup_contact_name.trim() || null,
    channel_backup_contact_phone: f.channel_backup_contact_phone.trim() || null,
    legal_name: f.legal_name.trim() || null,
    legal_id_number: f.legal_id_number.trim().toUpperCase() || null,
    legal_phone: f.legal_phone.trim() || null,
    legal_contact_address: f.legal_contact_address.trim() || null,
    legal_email: f.legal_email.trim() || null,
    enterprise_backup_name: f.enterprise_backup_name.trim() || null,
    enterprise_backup_phone: f.enterprise_backup_phone.trim() || null,
  };
}
