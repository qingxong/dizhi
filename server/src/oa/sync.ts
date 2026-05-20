import { nanoid } from "nanoid";
import { db } from "../db.js";
import type { CustomerRow } from "../customers.js";
import { fetchAllOaCustomers } from "./client.js";
import { mapOaRowToCustomer, oaRowDisplayLabel, oaRowHasFirstRowPhone, validateMappedOaCustomer } from "./map.js";

export type OaSyncResult = {
  imported: number;
  updated: number;
  skipped: number;
  /** 从 OA 拉取到的总条数（筛选销售负责人后） */
  total_fetched: number;
  errors: string[];
};

const MAX_ERROR_LINES = 25;

function nowIso() {
  return new Date().toISOString();
}

function findByOaEntryId(oaEntryId: string): CustomerRow | undefined {
  return db.prepare("SELECT * FROM customers WHERE oa_entry_id = ?").get(oaEntryId) as CustomerRow | undefined;
}

/** 仅同步当前登录用户在 OA 中「销售负责人」为自己的客户 */
export async function syncCustomersFromOa(opts: {
  actingUserId: string;
  oaMemberId: string | null;
}): Promise<OaSyncResult> {
  const result: OaSyncResult = { imported: 0, updated: 0, skipped: 0, total_fetched: 0, errors: [] };

  if (!opts.oaMemberId) {
    throw new Error("请先在用户管理中配置您的 OA 成员 ID（oa_member_id），再同步本人负责的客户");
  }

  const rows = await fetchAllOaCustomers(opts.oaMemberId);
  result.total_fetched = rows.length;

  let skipNoPhone = 0;
  let skipOther = 0;
  const detailErrors: string[] = [];
  const t = nowIso();

  for (const raw of rows) {
    if (!oaRowHasFirstRowPhone(raw)) {
      result.skipped += 1;
      skipNoPhone += 1;
      continue;
    }

    const mapped = mapOaRowToCustomer(raw);
    if ("error" in mapped) {
      result.skipped += 1;
      skipOther += 1;
      if (detailErrors.length < MAX_ERROR_LINES) {
        detailErrors.push(`${oaRowDisplayLabel(raw)}：${mapped.error}`);
      }
      continue;
    }

    const validErr = validateMappedOaCustomer(mapped);
    if (validErr) {
      result.skipped += 1;
      skipOther += 1;
      if (detailErrors.length < MAX_ERROR_LINES) {
        detailErrors.push(`${mapped.oa_customer_sn ?? mapped.oa_entry_id}：${validErr}`);
      }
      continue;
    }

    const ownerId = opts.actingUserId;
    const existing = findByOaEntryId(mapped.oa_entry_id);
    if (existing) {
      if (existing.created_by_user_id !== opts.actingUserId) {
        result.skipped += 1;
        skipOther += 1;
        continue;
      }
      db.prepare(
        `UPDATE customers SET
          customer_type = ?,
          channel_company_name = ?, channel_common_contact_name = ?, channel_common_contact_phone = ?,
          channel_backup_contact_name = ?, channel_backup_contact_phone = ?,
          legal_name = ?, legal_phone = ?,
          enterprise_backup_name = ?, enterprise_backup_phone = ?,
          oa_customer_sn = ?, source = 'oa', updated_at = ?
        WHERE oa_entry_id = ?`,
      ).run(
        mapped.customer_type,
        mapped.channel_company_name,
        mapped.channel_common_contact_name,
        mapped.channel_common_contact_phone,
        mapped.channel_backup_contact_name,
        mapped.channel_backup_contact_phone,
        mapped.legal_name,
        mapped.legal_phone,
        mapped.enterprise_backup_name,
        mapped.enterprise_backup_phone,
        mapped.oa_customer_sn,
        t,
        mapped.oa_entry_id,
      );
      result.updated += 1;
      continue;
    }

    const id = nanoid();
    db.prepare(
      `INSERT INTO customers (
        id, customer_type,
        channel_company_name, channel_common_contact_name, channel_common_contact_phone,
        channel_backup_contact_name, channel_backup_contact_phone,
        legal_name, legal_id_number, legal_phone, legal_contact_address, legal_email,
        enterprise_backup_name, enterprise_backup_phone,
        oa_entry_id, oa_customer_sn, source,
        created_by_user_id, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id,
      mapped.customer_type,
      mapped.channel_company_name,
      mapped.channel_common_contact_name,
      mapped.channel_common_contact_phone,
      mapped.channel_backup_contact_name,
      mapped.channel_backup_contact_phone,
      mapped.legal_name,
      null,
      mapped.legal_phone,
      null,
      null,
      mapped.enterprise_backup_name,
      mapped.enterprise_backup_phone,
      mapped.oa_entry_id,
      mapped.oa_customer_sn,
      "oa",
      ownerId,
      t,
      t,
    );
    result.imported += 1;
  }

  if (skipNoPhone > 0) {
    result.errors.push(
      `共 ${skipNoPhone} 条无对接人电话（子表单第 1 行与历史主表均无有效号码），已跳过`,
    );
  }
  if (skipOther > 0) {
    result.errors.push(`另有 ${skipOther} 条因客户类型等原因跳过`);
  }
  result.errors.push(...detailErrors);
  if (detailErrors.length >= MAX_ERROR_LINES) {
    result.errors.push("（仅展示部分明细）");
  }

  return result;
}
