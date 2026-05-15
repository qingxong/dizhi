import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import session from "express-session";
import { nanoid } from "nanoid";
import { existsSync } from "node:fs";
import { join } from "node:path";
import multer from "multer";
import {
  materialFromBody,
  materialPatchFromBody,
  validateAffiliationMaterial,
} from "./affiliationMaterial.js";
import { db } from "./db.js";
import { ID_PHOTO_UPLOAD_DIR, idPhotoMulter } from "./idPhotoUpload.js";
import { requireAdmin, requireAuth } from "./middleware/auth.js";

type SqlParam = string | number | bigint | null;

function routeId(p: string | string[] | undefined): string {
  if (p == null) return "";
  return typeof p === "string" ? p : p[0] ?? "";
}

const app = express();
const PORT = Number(process.env.PORT || process.env.API_PORT) || 3889;

if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  session({
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
  }),
);

function nowIso() {
  return new Date().toISOString();
}

/** 草稿 / 已驳回：可编辑的基础字段 + 材料字段（不含 action） */
function collectAffiliationDraftUpdates(b: Record<string, unknown>): { fields: string[]; vals: unknown[] } {
  const fields: string[] = [];
  const vals: unknown[] = [];
  const allowedText = ["applicant_name", "applicant_dept", "service_type", "notes"] as const;
  for (const k of allowedText) {
    if (b[k] !== undefined) {
      fields.push(`${k} = ?`);
      if (k === "notes") {
        vals.push(b[k] == null || b[k] === "" ? null : String(b[k]));
      } else if (k === "service_type") {
        vals.push(affiliationServiceTypeOrDefault(b[k]));
      } else if (k === "applicant_dept") {
        vals.push(b[k] == null || b[k] === "" ? "" : String(b[k]).trim());
      } else {
        vals.push(String(b[k]));
      }
    }
  }
  if (b.address_id !== undefined) {
    fields.push("address_id = ?");
    vals.push(String(b.address_id));
  }
  const mp = materialPatchFromBody(b);
  for (const [k, v] of Object.entries(mp)) {
    fields.push(`${k} = ?`);
    vals.push(v as SqlParam);
  }
  return { fields, vals };
}

function publicUser(req: express.Request) {
  if (!req.session.userId) return null;
  return {
    id: req.session.userId,
    username: req.session.username!,
    role: req.session.role!,
    displayName: req.session.displayName!,
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
    .prepare(
      "SELECT id, username, password_hash, role, display_name FROM users WHERE username = ? COLLATE NOCASE",
    )
    .get(username) as
    | { id: string; username: string; password_hash: string; role: "admin" | "sales"; display_name: string }
    | undefined;
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
    if (err) return res.status(500).json({ error: "退出失败" });
    res.status(204).send();
  });
});
app.use("/api/auth", authRouter);

/** ---------- Protected API（须挂在 /api/auth 之后，避免吞掉登录路由）---------- */
const api = express.Router();
api.use(requireAuth);

const ADDRESS_TYPES = ["affiliation", "coworking", "business_secretary"] as const;
type AddressType = (typeof ADDRESS_TYPES)[number];

const AFFILIATION_SERVICE_TYPES = ["地址挂靠", "集中办公区", "商务秘书"] as const;
type AffiliationServiceTypeLabel = (typeof AFFILIATION_SERVICE_TYPES)[number];

function isAddressType(v: unknown): v is AddressType {
  return typeof v === "string" && (ADDRESS_TYPES as readonly string[]).includes(v);
}

function affiliationServiceTypeOrDefault(v: unknown): AffiliationServiceTypeLabel {
  if (typeof v === "string" && (AFFILIATION_SERVICE_TYPES as readonly string[]).includes(v)) {
    return v as AffiliationServiceTypeLabel;
  }
  return "地址挂靠";
}

function canAccessAffiliationRow(
  req: express.Request,
  row: { created_by_user_id?: string | null },
): boolean {
  if (req.session.role === "admin") return true;
  const uid = req.session.userId;
  if (!uid) return false;
  return row.created_by_user_id === uid;
}

/** 业务员建单时选用地址（只读） */
api.get("/address-choices", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, address_type, address_region, detail_address FROM addresses ORDER BY updated_at DESC`,
    )
    .all();
  res.json(rows);
});

api.get("/addresses", requireAdmin, (req, res) => {
  const addressType = req.query.address_type as string | undefined;
  const q = (req.query.q as string | undefined)?.trim();
  let sql = "SELECT * FROM addresses WHERE 1=1";
  const params: string[] = [];
  if (addressType && isAddressType(addressType)) {
    sql += " AND address_type = ?";
    params.push(addressType);
  }
  if (q) {
    sql += " AND (address_region LIKE ? OR detail_address LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like);
  }
  sql += " ORDER BY updated_at DESC";
  res.json(db.prepare(sql).all(...params));
});

api.get("/addresses/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM addresses WHERE id = ?").get(routeId(req.params.id));
  if (!row) return res.status(404).json({ error: "未找到地址记录" });
  res.json(row);
});

api.post("/addresses", requireAdmin, (req, res) => {
  const b = req.body;
  if (!b?.address_region || !b?.detail_address || !isAddressType(b.address_type)) {
    return res.status(400).json({ error: "address_type、address_region、detail_address 为必填，且类型须合法" });
  }
  const id = nanoid();
  const t = nowIso();
  db.prepare(
    `INSERT INTO addresses (id, address_type, address_region, detail_address, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
  ).run(id, b.address_type, String(b.address_region).trim(), String(b.detail_address).trim(), t, t);
  res.status(201).json(db.prepare("SELECT * FROM addresses WHERE id = ?").get(id));
});

api.patch("/addresses/:id", requireAdmin, (req, res) => {
  const cur = db.prepare("SELECT * FROM addresses WHERE id = ?").get(routeId(req.params.id)) as Record<
    string,
    unknown
  > | undefined;
  if (!cur) return res.status(404).json({ error: "未找到地址记录" });
  const b = req.body;
  const fields: string[] = [];
  const vals: unknown[] = [];
  const allowed = ["address_type", "address_region", "detail_address"] as const;
  for (const k of allowed) {
    if (b[k] !== undefined) {
      if (k === "address_type" && !isAddressType(b[k])) {
        return res.status(400).json({ error: "address_type 不合法" });
      }
      fields.push(`${k} = ?`);
      vals.push(k === "address_region" || k === "detail_address" ? String(b[k]).trim() : b[k]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: "无有效更新字段" });
  fields.push("updated_at = ?");
  vals.push(nowIso());
  vals.push(routeId(req.params.id));
  db.prepare(`UPDATE addresses SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as SqlParam[]));
  res.json(db.prepare("SELECT * FROM addresses WHERE id = ?").get(routeId(req.params.id)));
});

api.delete("/addresses/:id", requireAdmin, (req, res) => {
  const r = db.prepare("DELETE FROM addresses WHERE id = ?").run(routeId(req.params.id));
  if (Number(r.changes) === 0) return res.status(404).json({ error: "未找到地址记录" });
  res.status(204).send();
});

const BCRYPT_ROUNDS = 10;

function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/** 用户管理（仅管理员） */
api.get("/users", requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT id, username, role, display_name, created_at FROM users ORDER BY role DESC, username COLLATE NOCASE`,
    )
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
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(uid) as
    | { password_hash: string }
    | undefined;
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
  db.prepare(
    `INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?,?,?,?,?,?)`,
  ).run(id, username, hashPassword(password), "sales", display_name, t);
  const out = db
    .prepare(`SELECT id, username, role, display_name, created_at FROM users WHERE id = ?`)
    .get(id);
  res.status(201).json(out);
});

api.patch("/users/:id", requireAdmin, (req, res) => {
  const id = routeId(req.params.id);
  const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(id) as
    | { id: string; role: string }
    | undefined;
  if (!target) {
    return res.status(404).json({ error: "用户不存在" });
  }
  if (target.role !== "sales") {
    return res.status(400).json({ error: "仅可编辑业务员账号" });
  }
  const b = req.body as Record<string, unknown>;
  const display_name = typeof b.display_name === "string" ? b.display_name.trim() : undefined;
  const passwordRaw = typeof b.password === "string" ? b.password : undefined;
  const password = passwordRaw !== undefined && passwordRaw !== "" ? passwordRaw : undefined;
  const username = typeof b.username === "string" ? b.username.trim() : undefined;
  if (display_name !== undefined && display_name.length === 0) {
    return res.status(400).json({ error: "显示名称不能为空" });
  }
  if (display_name === undefined && password === undefined && username === undefined) {
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
  const fields: string[] = [];
  const vals: unknown[] = [];
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
  vals.push(id);
  db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as SqlParam[]));
  const out = db.prepare(`SELECT id, username, role, display_name, created_at FROM users WHERE id = ?`).get(id);
  res.json(out);
});

api.delete("/users/:id", requireAdmin, (req, res) => {
  const id = routeId(req.params.id);
  if (id === req.session.userId) {
    return res.status(400).json({ error: "不能删除当前登录账号" });
  }
  const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id) as { role: string } | undefined;
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
api.post(
  "/affiliations/uploads/id-photo",
  (req, res, next) => {
    idPhotoMulter.single("file")(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          const msg = err.code === "LIMIT_FILE_SIZE" ? "单张图片不超过 8MB" : err.message;
          return res.status(400).json({ error: msg });
        }
        const e = err as Error;
        return res.status(400).json({ error: e.message || "上传失败" });
      }
      next();
    });
  },
  (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "请选择身份证照片文件" });
    res.status(201).json({ url: `/api/uploads/${f.filename}` });
  },
);

api.post(
  "/affiliations/uploads/license-photo",
  (req, res, next) => {
    idPhotoMulter.single("file")(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          const msg = err.code === "LIMIT_FILE_SIZE" ? "单张图片不超过 8MB" : err.message;
          return res.status(400).json({ error: msg });
        }
        const e = err as Error;
        return res.status(400).json({ error: e.message || "上传失败" });
      }
      next();
    });
  },
  (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: "请选择执照照片文件" });
    res.status(201).json({ url: `/api/uploads/${f.filename}` });
  },
);

/** 已登录用户可查看上传的证件图（Cookie 会话） */
api.get("/uploads/:filename", (req, res) => {
  const name = routeId(req.params.filename);
  if (!/^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(name)) {
    return res.status(400).send("Invalid filename");
  }
  const abs = join(ID_PHOTO_UPLOAD_DIR, name);
  if (!existsSync(abs)) return res.status(404).send("Not found");
  res.sendFile(abs);
});

api.get("/affiliations", (req, res) => {
  const isAdmin = req.session.role === "admin";
  const uid = req.session.userId;
  const sqlBase = `SELECT r.*, a.address_type, a.address_region, a.detail_address
       FROM affiliation_requests r
       JOIN addresses a ON a.id = r.address_id`;
  const order = ` ORDER BY r.updated_at DESC`;
  const rows = isAdmin
    ? db.prepare(sqlBase + order).all()
    : db.prepare(`${sqlBase} WHERE r.created_by_user_id = ?${order}`).all(uid!);
  res.json(rows);
});

api.post("/affiliations", (req, res) => {
  const b = req.body as Record<string, unknown>;
  if (!b?.address_id || !String(b.applicant_name ?? "").trim()) {
    return res.status(400).json({ error: "address_id、申请人为必填" });
  }
  const addr = db.prepare("SELECT id FROM addresses WHERE id = ?").get(String(b.address_id));
  if (!addr) return res.status(400).json({ error: "关联的地址不存在" });
  const status = b.status === "pending" ? "pending" : "draft";
  const material = materialFromBody(b);
  if (status === "pending") {
    const err = validateAffiliationMaterial({ ...material } as Record<string, unknown>);
    if (err) return res.status(400).json({ error: err });
  }
  const id = nanoid();
  const t = nowIso();
  const submittedAt = status === "pending" ? t : null;
  const applicantDept =
    b.applicant_dept != null && String(b.applicant_dept).trim() !== "" ? String(b.applicant_dept).trim() : "";
  const serviceType = affiliationServiceTypeOrDefault(b.service_type);
  const ownerId = req.session.userId;
  if (!ownerId) {
    return res.status(401).json({ error: "未登录" });
  }
  db.prepare(
    `INSERT INTO affiliation_requests (
      id, address_id, applicant_name, applicant_dept, service_type, status, notes,
      contact_type, need_address_change,
      channel_common_contact_name, channel_common_contact_phone,
      channel_backup_contact_name, channel_backup_contact_phone,
      legal_id_front, legal_id_back, legal_name, legal_phone, legal_contact_address, legal_email,
      enterprise_backup_name, enterprise_backup_phone, license_photo,
      created_by_user_id,
      created_at, updated_at, submitted_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    String(b.address_id),
    String(b.applicant_name).trim(),
    applicantDept,
    serviceType,
    status,
    b.notes != null && b.notes !== "" ? String(b.notes) : null,
    material.contact_type,
    material.need_address_change,
    material.channel_common_contact_name,
    material.channel_common_contact_phone,
    material.channel_backup_contact_name,
    material.channel_backup_contact_phone,
    material.legal_id_front,
    material.legal_id_back,
    material.legal_name,
    material.legal_phone,
    material.legal_contact_address,
    material.legal_email,
    material.enterprise_backup_name,
    material.enterprise_backup_phone,
    material.license_photo,
    ownerId,
    t,
    t,
    submittedAt,
  );
  const row = db
    .prepare(
      `SELECT r.*, a.address_type, a.address_region, a.detail_address
       FROM affiliation_requests r JOIN addresses a ON a.id = r.address_id WHERE r.id = ?`,
    )
    .get(id);
  res.status(201).json(row);
});

api.patch("/affiliations/:id", (req, res) => {
  const id = routeId(req.params.id);
  const cur = db.prepare("SELECT * FROM affiliation_requests WHERE id = ?").get(id) as
    | { status: string; created_by_user_id?: string | null }
    | undefined;
  if (!cur) return res.status(404).json({ error: "未找到申请" });

  const isAdmin = req.session.role === "admin";
  const isApproveReject = req.body?.action === "approve" || req.body?.action === "reject";
  if (isApproveReject && !isAdmin) {
    return res.status(403).json({ error: "仅管理员可审批挂靠申请" });
  }
  if (!isAdmin && !canAccessAffiliationRow(req, cur)) {
    return res.status(403).json({ error: "无权操作该申请" });
  }

  const b = req.body as Record<string, unknown>;
  const t = nowIso();

  const applyDraftBodyUpdates = () => {
    const { fields, vals } = collectAffiliationDraftUpdates(b);
    if (b.address_id !== undefined) {
      const addr = db.prepare("SELECT id FROM addresses WHERE id = ?").get(String(b.address_id));
      if (!addr) return "关联的地址不存在" as const;
    }
    if (fields.length) {
      fields.push("updated_at = ?");
      vals.push(t);
      vals.push(id);
      db.prepare(`UPDATE affiliation_requests SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as SqlParam[]));
    }
    return null;
  };

  if (b.action === "submit" && cur.status === "draft") {
    const upErr = applyDraftBodyUpdates();
    if (upErr) return res.status(400).json({ error: upErr });
    const full = db.prepare("SELECT * FROM affiliation_requests WHERE id = ?").get(id) as Record<string, unknown>;
    const err = validateAffiliationMaterial(full);
    if (err) return res.status(400).json({ error: err });
    db.prepare(
      "UPDATE affiliation_requests SET status = 'pending', submitted_at = ?, updated_at = ? WHERE id = ?",
    ).run(t, t, id);
  } else if (b.action === "resubmit") {
    if (cur.status !== "rejected") {
      return res.status(400).json({ error: "仅已驳回的申请可重新提交" });
    }
    const upErr = applyDraftBodyUpdates();
    if (upErr) return res.status(400).json({ error: upErr });
    const full = db.prepare("SELECT * FROM affiliation_requests WHERE id = ?").get(id) as Record<string, unknown>;
    const vErr = validateAffiliationMaterial(full);
    if (vErr) return res.status(400).json({ error: vErr });
    db.prepare(
      `UPDATE affiliation_requests SET status = 'pending', submitted_at = ?, updated_at = ?,
       reviewer_name = NULL, review_comment = NULL, reviewed_at = NULL WHERE id = ?`,
    ).run(t, t, id);
  } else if (b.action === "approve" || b.action === "reject") {
    if (cur.status !== "pending") {
      return res.status(400).json({ error: "仅待审批状态可操作" });
    }
    const st = b.action === "approve" ? "approved" : "rejected";
    const reviewer = req.session.displayName || req.session.username || "管理员";
    db.prepare(
      `UPDATE affiliation_requests SET status = ?, reviewer_name = ?, review_comment = ?,
       reviewed_at = ?, updated_at = ? WHERE id = ?`,
    ).run(
      st,
      b.reviewer_name ? String(b.reviewer_name) : reviewer,
      b.review_comment != null ? String(b.review_comment) : null,
      t,
      t,
      id,
    );
  } else {
    const canEdit = cur.status === "draft" || cur.status === "rejected";
    if (!canEdit) {
      return res.status(400).json({ error: "当前状态不可修改" });
    }
    const { fields, vals } = collectAffiliationDraftUpdates(b);
    if (b.address_id !== undefined) {
      const aid = String(b.address_id);
      const addr = db.prepare("SELECT id FROM addresses WHERE id = ?").get(aid);
      if (!addr) return res.status(400).json({ error: "关联的地址不存在" });
    }
    if (!fields.length) {
      return res.status(400).json({ error: "请提供要修改的字段" });
    }
    fields.push("updated_at = ?");
    vals.push(t);
    vals.push(id);
    db.prepare(`UPDATE affiliation_requests SET ${fields.join(", ")} WHERE id = ?`).run(...(vals as SqlParam[]));
  }

  const row = db
    .prepare(
      `SELECT r.*, a.address_type, a.address_region, a.detail_address
       FROM affiliation_requests r JOIN addresses a ON a.id = r.address_id WHERE r.id = ?`,
    )
    .get(id);
  res.json(row);
});

api.delete("/affiliations/:id", (req, res) => {
  const id = routeId(req.params.id);
  const cur = db
    .prepare("SELECT status, created_by_user_id FROM affiliation_requests WHERE id = ?")
    .get(id) as { status: string; created_by_user_id?: string | null } | undefined;
  if (!cur) return res.status(404).json({ error: "未找到申请" });
  if (req.session.role !== "admin") {
    if (!(req.session.role === "sales" && cur.status === "draft")) {
      return res.status(403).json({ error: "业务员仅可删除草稿；删除其他记录需管理员" });
    }
    if (cur.created_by_user_id !== req.session.userId) {
      return res.status(403).json({ error: "无权删除该申请" });
    }
  }
  const r = db.prepare("DELETE FROM affiliation_requests WHERE id = ?").run(id);
  if (Number(r.changes) === 0) return res.status(404).json({ error: "未找到申请" });
  res.status(204).send();
});

api.get("/stats", (req, res) => {
  const isAdmin = req.session.role === "admin";
  const uid = req.session.userId;

  if (isAdmin) {
    const byType = db
      .prepare(`SELECT address_type, COUNT(*) AS count FROM addresses GROUP BY address_type`)
      .all() as { address_type: string; count: number }[];
    const byAffStatus = db
      .prepare(`SELECT status, COUNT(*) AS count FROM affiliation_requests GROUP BY status`)
      .all() as { status: string; count: number }[];
    const totalAddresses = db.prepare("SELECT COUNT(*) AS c FROM addresses").get() as { c: number };
    const pendingApprovals = db
      .prepare("SELECT COUNT(*) AS c FROM affiliation_requests WHERE status = 'pending'")
      .get() as { c: number };
    const recent = db
      .prepare(
        `SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
         FROM addresses WHERE created_at >= date('now', '-12 months')
         GROUP BY month ORDER BY month`,
      )
      .all() as { month: string; count: number }[];

    res.json({
      platformAddressStats: true,
      totalAddresses: totalAddresses.c,
      pendingApprovals: pendingApprovals.c,
      addressesByType: Object.fromEntries(byType.map((x) => [x.address_type, x.count])),
      affiliationsByStatus: Object.fromEntries(byAffStatus.map((x) => [x.status, x.count])),
      newAddressesLast12Months: recent,
    });
    return;
  }

  const byAffStatus = db
    .prepare(
      `SELECT status, COUNT(*) AS count FROM affiliation_requests WHERE created_by_user_id = ? GROUP BY status`,
    )
    .all(uid!) as { status: string; count: number }[];
  const pendingApprovals = db
    .prepare(
      "SELECT COUNT(*) AS c FROM affiliation_requests WHERE status = 'pending' AND created_by_user_id = ?",
    )
    .get(uid!) as { c: number };

  res.json({
    platformAddressStats: false,
    totalAddresses: 0,
    pendingApprovals: pendingApprovals.c,
    addressesByType: {},
    affiliationsByStatus: Object.fromEntries(byAffStatus.map((x) => [x.status, x.count])),
    newAddressesLast12Months: [],
  });
});

app.use("/api", api);

const server = app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[server] Port ${PORT} is already in use. Stop the old API (e.g. close other terminals) or set another port, e.g.:`,
    );
    console.error(`  PowerShell:  $env:PORT='3890'; $env:API_PORT='3890'; npm run dev`);
    process.exit(1);
    return;
  }
  throw err;
});
