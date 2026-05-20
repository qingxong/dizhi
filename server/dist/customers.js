import { nanoid } from "nanoid";
import { db } from "./db.js";
import { isValidCnIdCard, isValidCnPhone, isValidEmail, normalizePhone } from "./contactFormat.js";
import { syncCustomersFromOa } from "./oa/sync.js";
function nowIso() {
    return new Date().toISOString();
}
function str(v) {
    if (v === undefined || v === null)
        return null;
    const s = String(v).trim();
    return s === "" ? null : s;
}
function nonempty(v) {
    return v != null && String(v).trim() !== "";
}
function normCompany(v) {
    return (v ?? "").trim().toLowerCase();
}
function normId(v) {
    return (v ?? "").trim().toUpperCase();
}
export function customerDisplayName(row) {
    if (row.customer_type === "channel") {
        const parts = [row.channel_company_name, row.channel_common_contact_name].filter(Boolean);
        return parts.length ? parts.join(" · ") : "渠道客户";
    }
    const name = row.legal_name?.trim();
    const id = row.legal_id_number?.trim();
    if (name && id)
        return `${name}（${id.slice(0, 4)}****${id.slice(-4)}）`;
    return name || id || "直客";
}
function rowFromBody(b) {
    const ct = b.customer_type === "channel" ? "channel" : "direct";
    const idNum = str(b.legal_id_number);
    return {
        customer_type: ct,
        channel_company_name: str(b.channel_company_name),
        channel_common_contact_name: str(b.channel_common_contact_name),
        channel_common_contact_phone: str(b.channel_common_contact_phone),
        channel_backup_contact_name: str(b.channel_backup_contact_name),
        channel_backup_contact_phone: str(b.channel_backup_contact_phone),
        legal_name: str(b.legal_name),
        legal_id_number: idNum ? idNum.toUpperCase() : null,
        legal_phone: str(b.legal_phone),
        legal_contact_address: str(b.legal_contact_address),
        legal_email: str(b.legal_email),
        enterprise_backup_name: str(b.enterprise_backup_name),
        enterprise_backup_phone: str(b.enterprise_backup_phone),
    };
}
export function validateCustomerFields(row, opts) {
    if (opts?.fromOa) {
        if (row.customer_type === "channel") {
            if (!nonempty(row.channel_company_name) &&
                !nonempty(row.channel_common_contact_name) &&
                !nonempty(row.channel_common_contact_phone)) {
                return "渠道客户至少需客户名称或常用联系人信息";
            }
        }
        else if (!nonempty(row.legal_name)) {
            return "请填写法人姓名（客户名称）";
        }
        if (row.channel_common_contact_phone && !isValidCnPhone(row.channel_common_contact_phone)) {
            return "渠道常用联系人电话格式不正确";
        }
        if (row.channel_backup_contact_phone && !isValidCnPhone(row.channel_backup_contact_phone)) {
            return "渠道备用联系人电话格式不正确";
        }
        if (row.legal_phone && !isValidCnPhone(row.legal_phone))
            return "法人手机号格式不正确";
        if (row.enterprise_backup_phone && !isValidCnPhone(row.enterprise_backup_phone)) {
            return "企业备用联系人电话格式不正确";
        }
        if (row.legal_id_number && !isValidCnIdCard(row.legal_id_number)) {
            return "法人身份证号格式不正确";
        }
        if (row.legal_email && !isValidEmail(row.legal_email))
            return "法人邮箱格式不正确";
        return null;
    }
    if (row.customer_type === "channel") {
        if (!nonempty(row.channel_common_contact_name))
            return "请填写渠道常用联系人姓名";
        if (!nonempty(row.channel_common_contact_phone))
            return "请填写渠道常用联系人电话";
        if (!nonempty(row.channel_backup_contact_name))
            return "请填写渠道备用联系人姓名";
        if (!nonempty(row.channel_backup_contact_phone))
            return "请填写渠道备用联系人电话";
        if (row.channel_common_contact_phone && !isValidCnPhone(row.channel_common_contact_phone)) {
            return "渠道常用联系人电话格式不正确";
        }
        if (row.channel_backup_contact_phone && !isValidCnPhone(row.channel_backup_contact_phone)) {
            return "渠道备用联系人电话格式不正确";
        }
        return null;
    }
    if (!nonempty(row.legal_name))
        return "请填写法人姓名";
    if (!nonempty(row.legal_id_number))
        return "请填写法人身份证号";
    if (!nonempty(row.legal_phone))
        return "请填写法人手机号";
    if (!nonempty(row.legal_contact_address))
        return "请填写法人联系地址";
    if (!nonempty(row.legal_email))
        return "请填写法人邮箱";
    if (!nonempty(row.enterprise_backup_name))
        return "请填写企业备用联系人姓名";
    if (!nonempty(row.enterprise_backup_phone))
        return "请填写企业备用联系人电话";
    if (row.legal_id_number && !isValidCnIdCard(row.legal_id_number)) {
        return "法人身份证号格式不正确，请填写18位有效身份证号码";
    }
    if (row.legal_phone && !isValidCnPhone(row.legal_phone))
        return "法人手机号格式不正确";
    if (row.enterprise_backup_phone && !isValidCnPhone(row.enterprise_backup_phone)) {
        return "企业备用联系人电话格式不正确";
    }
    if (row.legal_email && !isValidEmail(row.legal_email))
        return "法人邮箱格式不正确";
    return null;
}
function findChannelDuplicate(company, phone, excludeId) {
    if (!phone)
        return undefined;
    const nc = normCompany(company);
    const np = normalizePhone(phone);
    const rows = db.prepare("SELECT * FROM customers WHERE customer_type = 'channel'").all();
    return rows.find((r) => {
        if (excludeId && r.id === excludeId)
            return false;
        return normCompany(r.channel_company_name) === nc && normalizePhone(r.channel_common_contact_phone ?? "") === np;
    });
}
function findDirectDuplicate(idNumber, excludeId) {
    if (!idNumber)
        return undefined;
    const nid = normId(idNumber);
    const rows = db.prepare("SELECT * FROM customers WHERE customer_type = 'direct'").all();
    return rows.find((r) => {
        if (excludeId && r.id === excludeId)
            return false;
        return normId(r.legal_id_number) === nid;
    });
}
function duplicateMessage(existing, isAdmin) {
    const label = customerDisplayName(existing);
    if (isAdmin) {
        return `已存在相同客户档案：${label}。请直接在列表中编辑，避免重复建档。`;
    }
    return `已存在相同客户档案：${label}。若为您创建的记录可在客户管理中编辑；否则请联系管理员处理。`;
}
const CUSTOMER_SELECT = `
  SELECT c.*, u.display_name AS owner_display_name
  FROM customers c
  LEFT JOIN users u ON u.id = c.created_by_user_id`;
function canAccessRow(req, row) {
    if (req.session.role === "admin")
        return true;
    return row.created_by_user_id === req.session.userId;
}
function enrich(row) {
    return { ...row, display_name: customerDisplayName(row) };
}
function searchWhere(q) {
    const like = `%${q}%`;
    return {
        sql: ` AND (
      COALESCE(c.channel_company_name,'') LIKE ? OR
      COALESCE(c.channel_common_contact_name,'') LIKE ? OR
      COALESCE(c.channel_common_contact_phone,'') LIKE ? OR
      COALESCE(c.channel_backup_contact_name,'') LIKE ? OR
      COALESCE(c.channel_backup_contact_phone,'') LIKE ? OR
      COALESCE(c.legal_name,'') LIKE ? OR
      COALESCE(c.legal_id_number,'') LIKE ? OR
      COALESCE(c.legal_phone,'') LIKE ? OR
      COALESCE(c.enterprise_backup_name,'') LIKE ? OR
      COALESCE(c.enterprise_backup_phone,'') LIKE ? OR
      COALESCE(c.oa_customer_sn,'') LIKE ?
    )`,
        params: [like, like, like, like, like, like, like, like, like, like, like],
    };
}
export function registerCustomerRoutes(api) {
    api.get("/customers", (req, res) => {
        const isAdmin = req.session.role === "admin";
        const uid = req.session.userId;
        const type = req.query.type === "channel" || req.query.type === "direct" ? req.query.type : null;
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
        let sql = `${CUSTOMER_SELECT} WHERE 1=1`;
        const params = [];
        if (!isAdmin) {
            sql += " AND c.created_by_user_id = ?";
            params.push(uid);
        }
        if (type) {
            sql += " AND c.customer_type = ?";
            params.push(type);
        }
        if (q) {
            const sw = searchWhere(q);
            sql += sw.sql;
            params.push(...sw.params);
        }
        sql += " ORDER BY c.updated_at DESC";
        const rows = db.prepare(sql).all(...params).map(enrich);
        res.json(rows);
    });
    api.post("/customers/sync-from-oa", async (req, res) => {
        const uid = req.session.userId;
        if (!uid)
            return res.status(401).json({ error: "未登录" });
        const userRow = db.prepare("SELECT oa_member_id FROM users WHERE id = ?").get(uid);
        const oaMemberId = userRow?.oa_member_id?.trim() || null;
        try {
            const result = await syncCustomersFromOa({
                actingUserId: uid,
                oaMemberId,
            });
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    api.get("/customers/check-duplicate", (req, res) => {
        const ct = req.query.customer_type === "channel" ? "channel" : req.query.customer_type === "direct" ? "direct" : null;
        if (!ct)
            return res.status(400).json({ error: "请指定 customer_type" });
        const excludeId = typeof req.query.exclude_id === "string" ? req.query.exclude_id : undefined;
        const isAdmin = req.session.role === "admin";
        if (ct === "channel") {
            const company = typeof req.query.channel_company_name === "string" ? req.query.channel_company_name : "";
            const phone = typeof req.query.channel_common_contact_phone === "string" ? req.query.channel_common_contact_phone : "";
            if (!phone.trim())
                return res.json({ duplicate: false });
            const existing = findChannelDuplicate(company, phone, excludeId);
            if (!existing)
                return res.json({ duplicate: false });
            return res.json({
                duplicate: true,
                message: duplicateMessage(existing, isAdmin),
                existing_id: existing.id,
            });
        }
        const idNo = typeof req.query.legal_id_number === "string" ? req.query.legal_id_number : "";
        if (!idNo.trim())
            return res.json({ duplicate: false });
        const existing = findDirectDuplicate(idNo, excludeId);
        if (!existing)
            return res.json({ duplicate: false });
        return res.json({
            duplicate: true,
            message: duplicateMessage(existing, isAdmin),
            existing_id: existing.id,
        });
    });
    api.get("/customers/:id", (req, res) => {
        const id = String(req.params.id ?? "");
        const row = db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id);
        if (!row)
            return res.status(404).json({ error: "未找到客户" });
        if (!canAccessRow(req, row))
            return res.status(403).json({ error: "无权查看该客户" });
        res.json(enrich(row));
    });
    api.post("/customers", (req, res) => {
        const uid = req.session.userId;
        if (!uid)
            return res.status(401).json({ error: "未登录" });
        const body = rowFromBody(req.body);
        const err = validateCustomerFields(body);
        if (err)
            return res.status(400).json({ error: err });
        const isAdmin = req.session.role === "admin";
        if (body.customer_type === "channel") {
            const dup = findChannelDuplicate(body.channel_company_name, body.channel_common_contact_phone);
            if (dup)
                return res.status(409).json({ error: duplicateMessage(dup, isAdmin), existing_id: dup.id });
        }
        else {
            const dup = findDirectDuplicate(body.legal_id_number);
            if (dup)
                return res.status(409).json({ error: duplicateMessage(dup, isAdmin), existing_id: dup.id });
        }
        const id = nanoid();
        const t = nowIso();
        db.prepare(`INSERT INTO customers (
        id, customer_type,
        channel_company_name, channel_common_contact_name, channel_common_contact_phone,
        channel_backup_contact_name, channel_backup_contact_phone,
        legal_name, legal_id_number, legal_phone, legal_contact_address, legal_email,
        enterprise_backup_name, enterprise_backup_phone,
        oa_entry_id, oa_customer_sn, source,
        created_by_user_id, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, body.customer_type, body.channel_company_name, body.channel_common_contact_name, body.channel_common_contact_phone, body.channel_backup_contact_name, body.channel_backup_contact_phone, body.legal_name, body.legal_id_number, body.legal_phone, body.legal_contact_address, body.legal_email, body.enterprise_backup_name, body.enterprise_backup_phone, null, null, "local", uid, t, t);
        const row = db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id);
        res.status(201).json(enrich(row));
    });
    api.patch("/customers/:id", (req, res) => {
        const id = String(req.params.id ?? "");
        const cur = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
        if (!cur)
            return res.status(404).json({ error: "未找到客户" });
        if (!canAccessRow(req, cur))
            return res.status(403).json({ error: "无权修改该客户" });
        const b = req.body;
        const pick = (k) => (b[k] !== undefined ? b[k] : cur[k]);
        const merged = rowFromBody({
            customer_type: pick("customer_type"),
            channel_company_name: pick("channel_company_name"),
            channel_common_contact_name: pick("channel_common_contact_name"),
            channel_common_contact_phone: pick("channel_common_contact_phone"),
            channel_backup_contact_name: pick("channel_backup_contact_name"),
            channel_backup_contact_phone: pick("channel_backup_contact_phone"),
            legal_name: pick("legal_name"),
            legal_id_number: pick("legal_id_number"),
            legal_phone: pick("legal_phone"),
            legal_contact_address: pick("legal_contact_address"),
            legal_email: pick("legal_email"),
            enterprise_backup_name: pick("enterprise_backup_name"),
            enterprise_backup_phone: pick("enterprise_backup_phone"),
        });
        const fromOa = cur.source === "oa";
        const err = validateCustomerFields(merged, { fromOa });
        if (err)
            return res.status(400).json({ error: err });
        const isAdmin = req.session.role === "admin";
        if (!fromOa) {
            if (merged.customer_type === "channel") {
                const dup = findChannelDuplicate(merged.channel_company_name, merged.channel_common_contact_phone, id);
                if (dup)
                    return res.status(409).json({ error: duplicateMessage(dup, isAdmin), existing_id: dup.id });
            }
            else {
                const dup = findDirectDuplicate(merged.legal_id_number, id);
                if (dup)
                    return res.status(409).json({ error: duplicateMessage(dup, isAdmin), existing_id: dup.id });
            }
        }
        const t = nowIso();
        db.prepare(`UPDATE customers SET
        customer_type = ?,
        channel_company_name = ?, channel_common_contact_name = ?, channel_common_contact_phone = ?,
        channel_backup_contact_name = ?, channel_backup_contact_phone = ?,
        legal_name = ?, legal_id_number = ?, legal_phone = ?, legal_contact_address = ?, legal_email = ?,
        enterprise_backup_name = ?, enterprise_backup_phone = ?,
        updated_at = ?
      WHERE id = ?`).run(merged.customer_type, merged.channel_company_name, merged.channel_common_contact_name, merged.channel_common_contact_phone, merged.channel_backup_contact_name, merged.channel_backup_contact_phone, merged.legal_name, merged.legal_id_number, merged.legal_phone, merged.legal_contact_address, merged.legal_email, merged.enterprise_backup_name, merged.enterprise_backup_phone, t, id);
        const row = db.prepare(`${CUSTOMER_SELECT} WHERE c.id = ?`).get(id);
        res.json(enrich(row));
    });
    api.delete("/customers/:id", (req, res) => {
        const id = String(req.params.id ?? "");
        const cur = db.prepare("SELECT * FROM customers WHERE id = ?").get(id);
        if (!cur)
            return res.status(404).json({ error: "未找到客户" });
        if (!canAccessRow(req, cur))
            return res.status(403).json({ error: "无权删除该客户" });
        db.prepare("DELETE FROM customers WHERE id = ?").run(id);
        res.status(204).send();
    });
}
