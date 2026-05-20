import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import session from "express-session";
import { nanoid } from "nanoid";
import { existsSync } from "node:fs";
import { join } from "node:path";
import multer from "multer";
import { ADDRESS_ADMIN_SELECT, AFFILIATION_ROW_SELECT, findAvailableAddressId, getAddressAdminById, isAddressOccupied, isRegionValidForAddressType, listRegionsForAddressType, } from "./affiliationAddress.js";
import { materialFromBody, materialPatchFromBody, validateAffiliationMaterial, } from "./affiliationMaterial.js";
import { db } from "./db.js";
import { ID_PHOTO_UPLOAD_DIR, idPhotoMulter } from "./idPhotoUpload.js";
import { registerAgreementRoutes } from "./agreement/routes.js";
import { registerCustomerRoutes } from "./customers.js";
import { requireAdmin, requireAuth } from "./middleware/auth.js";
function routeId(p) {
    if (p == null)
        return "";
    return typeof p === "string" ? p : p[0] ?? "";
}
const app = express();
const PORT = Number(process.env.PORT || process.env.API_PORT) || 3889;
if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
}
app.use(cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
}));
app.use(express.json());
app.use(session({
    name: "dizhi.sid",
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "1",
    },
}));
function nowIso() {
    return new Date().toISOString();
}
/** 草稿 / 已驳回：可编辑的基础字段 + 材料字段（不含 action） */
function collectAffiliationDraftUpdates(b) {
    const fields = [];
    const vals = [];
    const allowedText = ["applicant_name", "applicant_dept", "notes", "group_name"];
    for (const k of allowedText) {
        if (b[k] !== undefined) {
            fields.push(`${k} = ?`);
            if (k === "notes" || k === "group_name") {
                vals.push(b[k] == null || b[k] === "" ? null : String(b[k]).trim());
            }
            else if (k === "applicant_dept") {
                vals.push(b[k] == null || b[k] === "" ? "" : String(b[k]).trim());
            }
            else {
                vals.push(String(b[k]));
            }
        }
    }
    if (b.requested_address_type !== undefined) {
        if (!isAddressType(b.requested_address_type)) {
            return { fields, vals, error: "地址类型不合法" };
        }
        fields.push("requested_address_type = ?");
        vals.push(b.requested_address_type);
        fields.push("service_type = ?");
        vals.push(serviceTypeFromAddressType(b.requested_address_type));
    }
    if (b.requested_address_region !== undefined) {
        const reg = String(b.requested_address_region).trim();
        if (!reg)
            return { fields, vals, error: "地址区域不能为空" };
        fields.push("requested_address_region = ?");
        vals.push(reg);
    }
    const mp = materialPatchFromBody(b);
    for (const [k, v] of Object.entries(mp)) {
        fields.push(`${k} = ?`);
        vals.push(v);
    }
    return { fields, vals };
}
function publicUser(req) {
    if (!req.session.userId)
        return null;
    return {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
        displayName: req.session.displayName,
    };
}
/** ---------- Public ---------- */
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "enterprise-address-manager-api" });
});
const authRouter = express.Router();
authRouter.get("/me", (req, res) => {
    res.json({ user: publicUser(req) });
});
authRouter.post("/login", (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!username || !password) {
        return res.status(400).json({ error: "请输入用户名和密码" });
    }
    const row = db
        .prepare("SELECT id, username, password_hash, role, display_name FROM users WHERE username = ? COLLATE NOCASE")
        .get(username);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        return res.status(401).json({ error: "用户名或密码错误" });
    }
    req.session.userId = row.id;
    req.session.username = row.username;
    req.session.role = row.role;
    req.session.displayName = row.display_name;
    res.json({ user: publicUser(req) });
});
authRouter.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err)
            return res.status(500).json({ error: "退出失败" });
        res.status(204).send();
    });
});
app.use("/api/auth", authRouter);
/** ---------- Protected API（须挂在 /api/auth 之后，避免吞掉登录路由）---------- */
const api = express.Router();
api.use(requireAuth);
const ADDRESS_TYPES = ["coworking", "business_secretary"];
const AFFILIATION_SERVICE_TYPES = ["集中办公区", "商务秘书"];
function isAddressType(v) {
    return typeof v === "string" && ADDRESS_TYPES.includes(v);
}
const ADDRESS_TYPE_CN_TO_EN = {
    集中办公区: "coworking",
    商务秘书: "business_secretary",
    /** 历史 Excel 中「地址挂靠」按集中办公区入库 */
    地址挂靠: "coworking",
};
function normalizeAddressTypeImport(raw) {
    const s = raw.trim();
    if (isAddressType(s))
        return s;
    return ADDRESS_TYPE_CN_TO_EN[s] ?? null;
}
function affiliationServiceTypeOrDefault(v) {
    if (typeof v === "string" && AFFILIATION_SERVICE_TYPES.includes(v)) {
        return v;
    }
    if (v === "地址挂靠")
        return "集中办公区";
    return "集中办公区";
}
function serviceTypeFromAddressType(type) {
    const map = {
        coworking: "集中办公区",
        business_secretary: "商务秘书",
    };
    return map[type];
}
function canAccessAffiliationRow(req, row) {
    if (req.session.role === "admin")
        return true;
    const uid = req.session.userId;
    if (!uid)
        return false;
    return row.created_by_user_id === uid;
}
/** 业务员建单时选用地址（只读） */
api.get("/address-choices", (_req, res) => {
    const rows = db
        .prepare(`SELECT id, address_type, address_region, detail_address FROM addresses ORDER BY updated_at DESC`)
        .all();
    res.json(rows);
});
/** 挂靠申请：按地址类型列出地址库中已有区域（供业务员选择） */
api.get("/address-regions", (req, res) => {
    const addressType = req.query.address_type;
    if (!addressType || !isAddressType(addressType)) {
        return res.status(400).json({ error: "请提供合法的 address_type" });
    }
    res.json({ regions: listRegionsForAddressType(addressType) });
});
api.get("/addresses", requireAdmin, (req, res) => {
    const addressType = req.query.address_type;
    const q = req.query.q?.trim();
    const occupancy = req.query.occupancy;
    let sql = `${ADDRESS_ADMIN_SELECT} WHERE 1=1`;
    const params = [];
    if (addressType && isAddressType(addressType)) {
        sql += " AND a.address_type = ?";
        params.push(addressType);
    }
    if (q) {
        sql += " AND (a.address_region LIKE ? OR a.detail_address LIKE ?)";
        const like = `%${q}%`;
        params.push(like, like);
    }
    if (occupancy === "available") {
        sql += " AND occ.id IS NULL";
    }
    else if (occupancy === "occupied") {
        sql += " AND occ.id IS NOT NULL";
    }
    sql += " ORDER BY a.updated_at DESC";
    res.json(db.prepare(sql).all(...params));
});
api.get("/addresses/:id", requireAdmin, (req, res) => {
    const row = getAddressAdminById(routeId(req.params.id));
    if (!row)
        return res.status(404).json({ error: "未找到地址记录" });
    res.json(row);
});
api.post("/addresses", requireAdmin, (req, res) => {
    const b = req.body;
    if (!b?.address_region || !b?.detail_address || !isAddressType(b.address_type)) {
        return res.status(400).json({ error: "address_type、address_region、detail_address 为必填，且类型须合法" });
    }
    const id = nanoid();
    const t = nowIso();
    db.prepare(`INSERT INTO addresses (id, address_type, address_region, detail_address, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`).run(id, b.address_type, String(b.address_region).trim(), String(b.detail_address).trim(), t, t);
    res.status(201).json(getAddressAdminById(id));
});
const ADDRESS_IMPORT_MAX = 500;
api.post("/addresses/import", requireAdmin, (req, res) => {
    const raw = req.body?.items;
    if (!Array.isArray(raw) || raw.length === 0) {
        return res.status(400).json({ error: "items 须为非空数组" });
    }
    if (raw.length > ADDRESS_IMPORT_MAX) {
        return res.status(400).json({ error: `单次最多导入 ${ADDRESS_IMPORT_MAX} 条` });
    }
    const normalized = [];
    const details = [];
    for (let i = 0; i < raw.length; i++) {
        const o = raw[i];
        const obj = typeof o === "object" && o !== null ? o : null;
        const typeRaw = obj?.address_type != null ? String(obj.address_type).trim() : "";
        const region = obj?.address_region != null ? String(obj.address_region).trim() : "";
        const detail = obj?.detail_address != null ? String(obj.detail_address).trim() : "";
        const msgs = [];
        const typeNorm = normalizeAddressTypeImport(typeRaw);
        if (!typeNorm || !region || !detail) {
            const parts = [];
            if (!typeNorm)
                parts.push("address_type 不合法（须为 coworking、business_secretary 或对应中文名称）");
            if (!region)
                parts.push("address_region 不能为空");
            if (!detail)
                parts.push("detail_address 不能为空");
            details.push({ row: i + 1, message: `第 ${i + 1} 条：${parts.join("；")}` });
        }
        else {
            normalized.push({ address_type: typeNorm, address_region: region, detail_address: detail });
        }
    }
    if (details.length) {
        return res.status(400).json({ error: "导入数据存在错误，未写入任何记录", details });
    }
    const insertStmt = db.prepare(`INSERT INTO addresses (id, address_type, address_region, detail_address, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`);
    const t = nowIso();
    try {
        db.exec("BEGIN IMMEDIATE");
        for (const row of normalized) {
            insertStmt.run(nanoid(), row.address_type, row.address_region, row.detail_address, t, t);
        }
        db.exec("COMMIT");
    }
    catch (e) {
        try {
            db.exec("ROLLBACK");
        }
        catch {
            /* ignore */
        }
        const msg = e instanceof Error ? e.message : "导入失败";
        return res.status(500).json({ error: msg });
    }
    res.status(201).json({ inserted: normalized.length });
});
api.patch("/addresses/:id", requireAdmin, (req, res) => {
    const cur = db.prepare("SELECT * FROM addresses WHERE id = ?").get(routeId(req.params.id));
    if (!cur)
        return res.status(404).json({ error: "未找到地址记录" });
    const b = req.body;
    const fields = [];
    const vals = [];
    const allowed = ["address_type", "address_region", "detail_address"];
    for (const k of allowed) {
        if (b[k] !== undefined) {
            if (k === "address_type" && !isAddressType(b[k])) {
                return res.status(400).json({ error: "address_type 不合法" });
            }
            fields.push(`${k} = ?`);
            vals.push(k === "address_region" || k === "detail_address" ? String(b[k]).trim() : b[k]);
        }
    }
    if (!fields.length)
        return res.status(400).json({ error: "无有效更新字段" });
    fields.push("updated_at = ?");
    vals.push(nowIso());
    vals.push(routeId(req.params.id));
    db.prepare(`UPDATE addresses SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
    res.json(getAddressAdminById(routeId(req.params.id)));
});
api.delete("/addresses/:id", requireAdmin, (req, res) => {
    const id = routeId(req.params.id);
    const exists = db.prepare("SELECT id FROM addresses WHERE id = ?").get(id);
    if (!exists)
        return res.status(404).json({ error: "未找到地址记录" });
    if (isAddressOccupied(id)) {
        return res.status(400).json({ error: "该地址已被领取占用，无法删除。请先在挂靠流程中处理关联的已通过申请。" });
    }
    const r = db.prepare("DELETE FROM addresses WHERE id = ?").run(id);
    if (Number(r.changes) === 0)
        return res.status(404).json({ error: "未找到地址记录" });
    res.status(204).send();
});
const BCRYPT_ROUNDS = 10;
function hashPassword(plain) {
    return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}
/** 用户管理（仅管理员） */
api.get("/users", requireAdmin, (_req, res) => {
    const rows = db
        .prepare(`SELECT id, username, role, display_name, oa_member_id, created_at FROM users ORDER BY role DESC, username COLLATE NOCASE`)
        .all();
    res.json(rows);
});
api.patch("/users/me/password", requireAdmin, (req, res) => {
    const uid = req.session.userId;
    if (!uid) {
        return res.status(401).json({ error: "未登录" });
    }
    const current = typeof req.body?.current_password === "string" ? req.body.current_password : "";
    const next = typeof req.body?.new_password === "string" ? req.body.new_password : "";
    if (!current || !next) {
        return res.status(400).json({ error: "请填写当前密码与新密码" });
    }
    if (next.length < 6) {
        return res.status(400).json({ error: "新密码至少 6 位" });
    }
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(uid);
    if (!row || !bcrypt.compareSync(current, row.password_hash)) {
        return res.status(400).json({ error: "当前密码不正确" });
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), uid);
    res.json({ ok: true });
});
api.post("/users", requireAdmin, (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const display_name = typeof req.body?.display_name === "string" ? req.body.display_name.trim() : "";
    if (!username || !password || !display_name) {
        return res.status(400).json({ error: "用户名、密码、显示名称为必填" });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "密码至少 6 位" });
    }
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(username)) {
        return res.status(400).json({ error: "用户名须为 2–32 位字母、数字或下划线" });
    }
    const exists = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username);
    if (exists) {
        return res.status(400).json({ error: "用户名已存在" });
    }
    const id = nanoid();
    const t = nowIso();
    db.prepare(`INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?,?,?,?,?,?)`).run(id, username, hashPassword(password), "sales", display_name, t);
    const out = db
        .prepare(`SELECT id, username, role, display_name, oa_member_id, created_at FROM users WHERE id = ?`)
        .get(id);
    res.status(201).json(out);
});
api.patch("/users/:id", requireAdmin, (req, res) => {
    const id = routeId(req.params.id);
    const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(id);
    if (!target) {
        return res.status(404).json({ error: "用户不存在" });
    }
    if (target.role !== "sales") {
        return res.status(400).json({ error: "仅可编辑业务员账号" });
    }
    const b = req.body;
    const display_name = typeof b.display_name === "string" ? b.display_name.trim() : undefined;
    const passwordRaw = typeof b.password === "string" ? b.password : undefined;
    const password = passwordRaw !== undefined && passwordRaw !== "" ? passwordRaw : undefined;
    const username = typeof b.username === "string" ? b.username.trim() : undefined;
    const oa_member_id = b.oa_member_id === null || b.oa_member_id === ""
        ? null
        : typeof b.oa_member_id === "string"
            ? b.oa_member_id.trim() || null
            : undefined;
    if (display_name !== undefined && display_name.length === 0) {
        return res.status(400).json({ error: "显示名称不能为空" });
    }
    if (display_name === undefined &&
        password === undefined &&
        username === undefined &&
        oa_member_id === undefined) {
        return res.status(400).json({ error: "请提供要修改的字段" });
    }
    if (password !== undefined && password.length < 6) {
        return res.status(400).json({ error: "密码至少 6 位" });
    }
    if (username !== undefined) {
        if (!/^[a-zA-Z0-9_]{2,32}$/.test(username)) {
            return res.status(400).json({ error: "用户名须为 2–32 位字母、数字或下划线" });
        }
        const clash = db
            .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE AND id != ?")
            .get(username, id);
        if (clash) {
            return res.status(400).json({ error: "用户名已被占用" });
        }
    }
    const fields = [];
    const vals = [];
    if (username !== undefined) {
        fields.push("username = ?");
        vals.push(username);
    }
    if (display_name !== undefined) {
        fields.push("display_name = ?");
        vals.push(display_name);
    }
    if (password !== undefined) {
        fields.push("password_hash = ?");
        vals.push(hashPassword(password));
    }
    if (oa_member_id !== undefined) {
        fields.push("oa_member_id = ?");
        vals.push(oa_member_id);
    }
    vals.push(id);
    db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
    const out = db
        .prepare(`SELECT id, username, role, display_name, oa_member_id, created_at FROM users WHERE id = ?`)
        .get(id);
    res.json(out);
});
api.delete("/users/:id", requireAdmin, (req, res) => {
    const id = routeId(req.params.id);
    if (id === req.session.userId) {
        return res.status(400).json({ error: "不能删除当前登录账号" });
    }
    const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id);
    if (!target) {
        return res.status(404).json({ error: "用户不存在" });
    }
    if (target.role !== "sales") {
        return res.status(400).json({ error: "仅可删除业务员账号" });
    }
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.status(204).send();
});
/** 法人身份证 / 执照：multipart 上传后返回可存入申请的 URL 路径 */
api.post("/affiliations/uploads/id-photo", (req, res, next) => {
    idPhotoMulter.single("file")(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                const msg = err.code === "LIMIT_FILE_SIZE" ? "单张图片不超过 8MB" : err.message;
                return res.status(400).json({ error: msg });
            }
            const e = err;
            return res.status(400).json({ error: e.message || "上传失败" });
        }
        next();
    });
}, (req, res) => {
    const f = req.file;
    if (!f)
        return res.status(400).json({ error: "请选择身份证照片文件" });
    res.status(201).json({ url: `/api/uploads/${f.filename}` });
});
api.post("/affiliations/uploads/license-photo", (req, res, next) => {
    idPhotoMulter.single("file")(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                const msg = err.code === "LIMIT_FILE_SIZE" ? "单张图片不超过 8MB" : err.message;
                return res.status(400).json({ error: msg });
            }
            const e = err;
            return res.status(400).json({ error: e.message || "上传失败" });
        }
        next();
    });
}, (req, res) => {
    const f = req.file;
    if (!f)
        return res.status(400).json({ error: "请选择执照照片文件" });
    res.status(201).json({ url: `/api/uploads/${f.filename}` });
});
/** 已登录用户可查看上传的证件图（Cookie 会话） */
api.get("/uploads/:filename", (req, res) => {
    const name = routeId(req.params.filename);
    if (!/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(name)) {
        return res.status(400).send("Invalid filename");
    }
    const abs = join(ID_PHOTO_UPLOAD_DIR, name);
    if (!existsSync(abs))
        return res.status(404).send("Not found");
    res.sendFile(abs);
});
api.get("/affiliations", (req, res) => {
    const isAdmin = req.session.role === "admin";
    const uid = req.session.userId;
    const order = ` ORDER BY r.updated_at DESC`;
    const rows = isAdmin
        ? db.prepare(`${AFFILIATION_ROW_SELECT}${order}`).all()
        : db.prepare(`${AFFILIATION_ROW_SELECT} WHERE r.created_by_user_id = ?${order}`).all(uid);
    res.json(rows);
});
api.post("/affiliations", (req, res) => {
    const b = req.body;
    const applicant = String(b?.applicant_name ?? "").trim();
    if (!applicant) {
        return res.status(400).json({ error: "申请人为必填" });
    }
    if (!isAddressType(b?.requested_address_type)) {
        return res.status(400).json({ error: "请选择合法的地址类型" });
    }
    const requestedRegion = String(b?.requested_address_region ?? "").trim();
    if (!requestedRegion) {
        return res.status(400).json({ error: "请选择地址区域" });
    }
    if (!isRegionValidForAddressType(b.requested_address_type, requestedRegion)) {
        return res.status(400).json({ error: "该区域在当前地址类型下不存在，请联系管理员在地址库中维护" });
    }
    const status = b.status === "pending" ? "pending" : "draft";
    const material = materialFromBody(b);
    if (status === "pending") {
        const err = validateAffiliationMaterial({ ...material });
        if (err)
            return res.status(400).json({ error: err });
    }
    const id = nanoid();
    const t = nowIso();
    const submittedAt = status === "pending" ? t : null;
    const applicantDept = b.applicant_dept != null && String(b.applicant_dept).trim() !== "" ? String(b.applicant_dept).trim() : "";
    const reqType = b.requested_address_type;
    const serviceType = serviceTypeFromAddressType(reqType);
    const ownerId = req.session.userId;
    if (!ownerId) {
        return res.status(401).json({ error: "未登录" });
    }
    try {
        db.prepare(`INSERT INTO affiliation_requests (
        id, address_id, requested_address_type, requested_address_region,
        applicant_name, applicant_dept, service_type, status, notes, group_name,
        contact_type, need_address_change,
        channel_company_name,
        channel_common_contact_name, channel_common_contact_phone,
        channel_backup_contact_name, channel_backup_contact_phone,
        legal_id_front, legal_id_back, legal_name, legal_id_number, legal_phone, legal_contact_address, legal_email,
        enterprise_backup_name, enterprise_backup_phone, license_photo,
        created_by_user_id,
        created_at, updated_at, submitted_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, null, reqType, requestedRegion, applicant, applicantDept, serviceType, status, b.notes != null && b.notes !== "" ? String(b.notes) : null, b.group_name != null && String(b.group_name).trim() !== "" ? String(b.group_name).trim() : null, material.contact_type, material.need_address_change, material.channel_company_name, material.channel_common_contact_name, material.channel_common_contact_phone, material.channel_backup_contact_name, material.channel_backup_contact_phone, material.legal_id_front, material.legal_id_back, material.legal_name, material.legal_id_number, material.legal_phone, material.legal_contact_address, material.legal_email, material.enterprise_backup_name, material.enterprise_backup_phone, material.license_photo, ownerId, t, t, submittedAt);
    }
    catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "创建失败";
        return res.status(500).json({ error: msg });
    }
    const row = db.prepare(`${AFFILIATION_ROW_SELECT} WHERE r.id = ?`).get(id);
    res.status(201).json(row);
});
api.patch("/affiliations/:id", (req, res) => {
    const id = routeId(req.params.id);
    const cur = db.prepare("SELECT * FROM affiliation_requests WHERE id = ?").get(id);
    if (!cur)
        return res.status(404).json({ error: "未找到申请" });
    const isAdmin = req.session.role === "admin";
    const isApproveReject = req.body?.action === "approve" || req.body?.action === "reject";
    if (isApproveReject && !isAdmin) {
        return res.status(403).json({ error: "仅管理员可审批挂靠申请" });
    }
    if (!isAdmin && !canAccessAffiliationRow(req, cur)) {
        return res.status(403).json({ error: "无权操作该申请" });
    }
    const b = req.body;
    const t = nowIso();
    const applyDraftBodyUpdates = () => {
        const { fields, vals, error } = collectAffiliationDraftUpdates(b);
        if (error)
            return error;
        if (fields.length) {
            fields.push("updated_at = ?");
            vals.push(t);
            vals.push(id);
            db.prepare(`UPDATE affiliation_requests SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
        }
        return null;
    };
    const assertRequestedRegion = (row) => {
        if (!isAddressType(row.requested_address_type))
            return "地址类型无效";
        if (!isRegionValidForAddressType(row.requested_address_type, row.requested_address_region)) {
            return "地址区域在当前类型下不可用，请重新选择或联系管理员维护地址库";
        }
        return null;
    };
    if (b.action === "submit" && cur.status === "draft") {
        const upErr = applyDraftBodyUpdates();
        if (upErr)
            return res.status(400).json({ error: upErr });
        const full = db.prepare("SELECT * FROM affiliation_requests WHERE id = ?").get(id);
        const regionErr = assertRequestedRegion(full);
        if (regionErr)
            return res.status(400).json({ error: regionErr });
        const err = validateAffiliationMaterial(full);
        if (err)
            return res.status(400).json({ error: err });
        db.prepare("UPDATE affiliation_requests SET status = 'pending', submitted_at = ?, updated_at = ? WHERE id = ?").run(t, t, id);
    }
    else if (b.action === "resubmit") {
        if (cur.status !== "rejected") {
            return res.status(400).json({ error: "仅已驳回的申请可重新提交" });
        }
        const upErr = applyDraftBodyUpdates();
        if (upErr)
            return res.status(400).json({ error: upErr });
        const full = db.prepare("SELECT * FROM affiliation_requests WHERE id = ?").get(id);
        const regionErr = assertRequestedRegion(full);
        if (regionErr)
            return res.status(400).json({ error: regionErr });
        const vErr = validateAffiliationMaterial(full);
        if (vErr)
            return res.status(400).json({ error: vErr });
        db.prepare(`UPDATE affiliation_requests SET status = 'pending', submitted_at = ?, updated_at = ?,
       address_id = NULL, reviewer_name = NULL, review_comment = NULL, reviewed_at = NULL WHERE id = ?`).run(t, t, id);
    }
    else if (b.action === "approve" || b.action === "reject") {
        if (cur.status !== "pending") {
            return res.status(400).json({ error: "仅待审批状态可操作" });
        }
        const st = b.action === "approve" ? "approved" : "rejected";
        const reviewer = req.session.displayName || req.session.username || "管理员";
        if (b.action === "approve") {
            const full = db.prepare("SELECT * FROM affiliation_requests WHERE id = ?").get(id);
            if (!full)
                return res.status(404).json({ error: "未找到申请" });
            const reqType = full.requested_address_type;
            if (!isAddressType(reqType)) {
                return res.status(400).json({ error: "申请记录的地址类型无效" });
            }
            const assignedId = findAvailableAddressId(reqType, full.requested_address_region);
            if (!assignedId) {
                return res.status(400).json({
                    error: `「${full.requested_address_region}」下暂无可用详细地址，请先在地址库补充该类型/区域资源`,
                });
            }
            db.prepare(`UPDATE affiliation_requests SET status = ?, address_id = ?, reviewer_name = ?, review_comment = ?,
         reviewed_at = ?, updated_at = ? WHERE id = ?`).run(st, assignedId, b.reviewer_name ? String(b.reviewer_name) : reviewer, b.review_comment != null ? String(b.review_comment) : null, t, t, id);
        }
        else {
            db.prepare(`UPDATE affiliation_requests SET status = ?, reviewer_name = ?, review_comment = ?,
         reviewed_at = ?, updated_at = ? WHERE id = ?`).run(st, b.reviewer_name ? String(b.reviewer_name) : reviewer, b.review_comment != null ? String(b.review_comment) : null, t, t, id);
        }
    }
    else {
        const salesCanEdit = cur.status === "draft" || cur.status === "rejected";
        if (!isAdmin && !salesCanEdit) {
            return res.status(400).json({ error: "当前状态不可修改" });
        }
        const prevApproved = isAdmin && cur.status === "approved"
            ? db.prepare("SELECT requested_address_type, requested_address_region FROM affiliation_requests WHERE id = ?").get(id)
            : null;
        const { fields, vals, error } = collectAffiliationDraftUpdates(b);
        if (error)
            return res.status(400).json({ error });
        if (!fields.length) {
            return res.status(400).json({ error: "请提供要修改的字段" });
        }
        fields.push("updated_at = ?");
        vals.push(t);
        vals.push(id);
        db.prepare(`UPDATE affiliation_requests SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
        if (prevApproved && (b.requested_address_type !== undefined || b.requested_address_region !== undefined)) {
            const full = db.prepare("SELECT requested_address_type, requested_address_region FROM affiliation_requests WHERE id = ?").get(id);
            const regionErr = assertRequestedRegion(full);
            if (regionErr)
                return res.status(400).json({ error: regionErr });
            const changed = full.requested_address_type !== prevApproved.requested_address_type ||
                full.requested_address_region.trim() !== prevApproved.requested_address_region.trim();
            if (changed) {
                const reqType = full.requested_address_type;
                const assignedId = findAvailableAddressId(reqType, full.requested_address_region);
                if (!assignedId) {
                    return res.status(400).json({
                        error: `「${full.requested_address_region}」下暂无可用详细地址，请先在地址库补充该类型/区域资源`,
                    });
                }
                db.prepare("UPDATE affiliation_requests SET address_id = ?, updated_at = ? WHERE id = ?").run(assignedId, t, id);
            }
        }
    }
    const row = db.prepare(`${AFFILIATION_ROW_SELECT} WHERE r.id = ?`).get(id);
    res.json(row);
});
api.delete("/affiliations/:id", (req, res) => {
    const id = routeId(req.params.id);
    if (req.session.role !== "admin") {
        return res.status(403).json({ error: "仅管理员可删除挂靠申请" });
    }
    const cur = db.prepare("SELECT id FROM affiliation_requests WHERE id = ?").get(id);
    if (!cur)
        return res.status(404).json({ error: "未找到申请" });
    const r = db.prepare("DELETE FROM affiliation_requests WHERE id = ?").run(id);
    if (Number(r.changes) === 0)
        return res.status(404).json({ error: "未找到申请" });
    res.status(204).send();
});
registerAgreementRoutes(api, {
    db,
    requireAdmin,
    canAccessAffiliationRow,
    affiliationRowSelect: AFFILIATION_ROW_SELECT,
});
registerCustomerRoutes(api);
api.get("/stats", (req, res) => {
    const isAdmin = req.session.role === "admin";
    const uid = req.session.userId;
    if (isAdmin) {
        const byType = db
            .prepare(`SELECT address_type, COUNT(*) AS count FROM addresses GROUP BY address_type`)
            .all();
        const byAffStatus = db
            .prepare(`SELECT status, COUNT(*) AS count FROM affiliation_requests GROUP BY status`)
            .all();
        const totalAddresses = db.prepare("SELECT COUNT(*) AS c FROM addresses").get();
        const pendingApprovals = db
            .prepare("SELECT COUNT(*) AS c FROM affiliation_requests WHERE status = 'pending'")
            .get();
        const pendingAgreementApprovals = db
            .prepare("SELECT COUNT(*) AS c FROM affiliation_requests WHERE agreement_status = 'pending'")
            .get();
        const recent = db
            .prepare(`SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
         FROM addresses WHERE created_at >= date('now', '-12 months')
         GROUP BY month ORDER BY month`)
            .all();
        res.json({
            platformAddressStats: true,
            totalAddresses: totalAddresses.c,
            pendingApprovals: pendingApprovals.c,
            pendingAgreementApprovals: pendingAgreementApprovals.c,
            addressesByType: Object.fromEntries(byType.map((x) => [x.address_type, x.count])),
            affiliationsByStatus: Object.fromEntries(byAffStatus.map((x) => [x.status, x.count])),
            newAddressesLast12Months: recent,
        });
        return;
    }
    const byAffStatus = db
        .prepare(`SELECT status, COUNT(*) AS count FROM affiliation_requests WHERE created_by_user_id = ? GROUP BY status`)
        .all(uid);
    const pendingApprovals = db
        .prepare("SELECT COUNT(*) AS c FROM affiliation_requests WHERE status = 'pending' AND created_by_user_id = ?")
        .get(uid);
    const pendingAgreementApprovals = db
        .prepare("SELECT COUNT(*) AS c FROM affiliation_requests WHERE agreement_status = 'pending' AND created_by_user_id = ?")
        .get(uid);
    res.json({
        platformAddressStats: false,
        totalAddresses: 0,
        pendingApprovals: pendingApprovals.c,
        pendingAgreementApprovals: pendingAgreementApprovals.c,
        addressesByType: {},
        affiliationsByStatus: Object.fromEntries(byAffStatus.map((x) => [x.status, x.count])),
        newAddressesLast12Months: [],
    });
});
app.use("/api", api);
app.use((err, _req, res, _next) => {
    console.error(err);
    const msg = err instanceof Error ? err.message : "服务器错误";
    if (!res.headersSent)
        res.status(500).json({ error: msg });
});
const server = app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`[server] Port ${PORT} is already in use. Stop the old API (e.g. close other terminals) or set another port, e.g.:`);
        console.error(`  PowerShell:  $env:PORT='3890'; $env:API_PORT='3890'; npm run dev`);
        process.exit(1);
        return;
    }
    throw err;
});
