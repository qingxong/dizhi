import { isValidCnPhone } from "../contactFormat.js";
import { OA, OA_CONTACT_METHOD_PHONE, OA_CUSTOMER_TYPE_CHANNEL, OA_CUSTOMER_TYPE_DIRECT } from "./constants.js";
const F = OA.FIELDS;
function str(v) {
    if (v === undefined || v === null)
        return null;
    const s = String(v).trim();
    return s === "" ? null : s;
}
function parseCustomerType(raw) {
    const t = str(raw);
    if (t === OA_CUSTOMER_TYPE_CHANNEL)
        return "channel";
    if (t === OA_CUSTOMER_TYPE_DIRECT)
        return "direct";
    return null;
}
function parseOwner(raw) {
    if (raw == null)
        return { id: null, name: null };
    if (typeof raw === "string")
        return { id: raw.trim() || null, name: null };
    if (typeof raw === "object" && raw !== null) {
        const o = raw;
        return { id: str(o._id), name: str(o.name) };
    }
    return { id: null, name: null };
}
function pickSubField(row, ...keys) {
    for (const k of keys) {
        const v = str(row[k]);
        if (v)
            return v;
    }
    return null;
}
/** 子表单行（兼容 widget 别名） */
export function parseContactsSubform(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw.map((row) => {
        if (!row || typeof row !== "object") {
            return { name: null, methodType: null, method: null };
        }
        const r = row;
        return {
            name: pickSubField(r, F.contactName),
            methodType: pickSubField(r, F.contactMethodType),
            method: pickSubField(r, F.contactMethod),
        };
    });
}
function looksLikePhoneText(raw) {
    if (!raw)
        return false;
    const t = raw.trim();
    if (!t || t.includes("备注"))
        return false;
    return /\d{7,}/.test(t);
}
function phoneFromRow(row) {
    if (!row?.method)
        return null;
    const type = row.methodType ?? "";
    if (type && type !== OA_CONTACT_METHOD_PHONE && !type.includes("电话")) {
        return null;
    }
    const phone = row.method.trim();
    if (!looksLikePhoneText(phone))
        return null;
    return isValidCnPhone(phone) ? phone : phone;
}
/** 主表历史联系人字段（子表单未迁移时） */
function legacyContactRow(row) {
    const phone = str(row[F.legacyContact]);
    if (!looksLikePhoneText(phone))
        return null;
    const type = str(row[F.legacyContactType]);
    if (type && type !== OA_CONTACT_METHOD_PHONE && !type.includes("电话")) {
        return null;
    }
    return {
        name: str(row[F.legacyContactName]),
        methodType: type || OA_CONTACT_METHOD_PHONE,
        method: phone,
    };
}
/** 优先子表单第 1 行，否则回退历史主表电话 */
function resolveContactRows(row) {
    const contacts = parseContactsSubform(row[F.contactsSubform]);
    if (phoneFromRow(contacts[0])) {
        return { row0: contacts[0], row1: contacts[1] };
    }
    const legacy = legacyContactRow(row);
    if (legacy) {
        return { row0: legacy, row1: contacts[0] ?? contacts[1] };
    }
    return { row0: contacts[0], row1: contacts[1] };
}
export function oaRowHasFirstRowPhone(row) {
    return phoneFromRow(resolveContactRows(row).row0) != null;
}
export function oaRowDisplayLabel(row) {
    return str(row[F.customerSn]) ?? str(row._id) ?? "未知";
}
export function mapOaRowToCustomer(row) {
    const oaEntryId = str(row._id);
    if (!oaEntryId)
        return { error: "缺少 OA 数据 _id" };
    const customerType = parseCustomerType(row[F.customerType]);
    if (!customerType) {
        return { error: `未知客户类型：${String(row[F.customerType] ?? "")}` };
    }
    const customerName = str(row[F.customerName]);
    const { row0, row1 } = resolveContactRows(row);
    const owner = parseOwner(row[F.salesOwner]);
    const base = {
        oa_entry_id: oaEntryId,
        oa_customer_sn: str(row[F.customerSn]),
        oa_sales_owner_id: owner.id,
        oa_sales_owner_name: owner.name,
    };
    if (customerType === "channel") {
        return {
            ...base,
            customer_type: "channel",
            channel_company_name: customerName,
            channel_common_contact_name: row0?.name ?? customerName,
            channel_common_contact_phone: phoneFromRow(row0),
            channel_backup_contact_name: row1?.name ?? null,
            channel_backup_contact_phone: phoneFromRow(row1),
            legal_name: null,
            legal_phone: null,
            enterprise_backup_name: null,
            enterprise_backup_phone: null,
        };
    }
    return {
        ...base,
        customer_type: "direct",
        channel_company_name: null,
        channel_common_contact_name: null,
        channel_common_contact_phone: null,
        channel_backup_contact_name: null,
        channel_backup_contact_phone: null,
        legal_name: customerName,
        legal_phone: phoneFromRow(row0),
        enterprise_backup_name: row1?.name ?? null,
        enterprise_backup_phone: phoneFromRow(row1),
    };
}
export function validateMappedOaCustomer(m) {
    if (m.customer_type === "channel") {
        if (!m.channel_company_name && !m.channel_common_contact_name) {
            return "渠道客户缺少客户名称";
        }
        return null;
    }
    if (!m.legal_name)
        return "直客缺少客户名称";
    return null;
}
