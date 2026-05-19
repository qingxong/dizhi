import bcrypt from "bcryptjs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "addresses.db");
export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");
/** 若存在旧版「企业地址」表结构，则丢弃后按新结构重建（会清空挂靠申请） */
const addrTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='addresses'").get();
if (addrTable) {
    const cols = db.prepare("PRAGMA table_info(addresses)").all();
    const legacy = cols.some((c) => c.name === "company_name");
    if (legacy) {
        db.exec("DROP TABLE IF EXISTS affiliation_requests");
        db.exec("DROP TABLE IF EXISTS addresses");
    }
}
db.exec(`
  CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    address_type TEXT NOT NULL CHECK (address_type IN ('affiliation', 'coworking', 'business_secretary')),
    address_region TEXT NOT NULL,
    detail_address TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS affiliation_requests (
    id TEXT PRIMARY KEY,
    address_id TEXT NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
    applicant_name TEXT NOT NULL,
    applicant_dept TEXT NOT NULL DEFAULT '',
    service_type TEXT NOT NULL DEFAULT '地址挂靠',
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    notes TEXT,
    reviewer_name TEXT,
    review_comment TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    submitted_at TEXT,
    reviewed_at TEXT,
    contact_type TEXT NOT NULL DEFAULT 'direct' CHECK (contact_type IN ('channel', 'direct')),
    need_address_change INTEGER NOT NULL DEFAULT 0,
    channel_common_contact_name TEXT,
    channel_common_contact_phone TEXT,
    channel_backup_contact_name TEXT,
    channel_backup_contact_phone TEXT,
    legal_id_front TEXT,
    legal_id_back TEXT,
    legal_name TEXT,
    legal_phone TEXT,
    legal_contact_address TEXT,
    legal_email TEXT,
    enterprise_backup_name TEXT,
    enterprise_backup_phone TEXT,
    license_photo TEXT,
    created_by_user_id TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'sales')),
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_addresses_type ON addresses(address_type);
  CREATE INDEX IF NOT EXISTS idx_affiliation_status ON affiliation_requests(status);
  CREATE INDEX IF NOT EXISTS idx_affiliation_address ON affiliation_requests(address_id);
`);
{
    const names = new Set(db.prepare("PRAGMA table_info(affiliation_requests)").all().map((c) => c.name));
    const add = (col, def) => {
        if (!names.has(col)) {
            db.exec(`ALTER TABLE affiliation_requests ADD COLUMN ${col} ${def}`);
            names.add(col);
        }
    };
    add("contact_type", "TEXT NOT NULL DEFAULT 'direct'");
    add("need_address_change", "INTEGER NOT NULL DEFAULT 0");
    add("channel_common_contact_name", "TEXT");
    add("channel_common_contact_phone", "TEXT");
    add("channel_backup_contact_name", "TEXT");
    add("channel_backup_contact_phone", "TEXT");
    add("legal_id_front", "TEXT");
    add("legal_id_back", "TEXT");
    add("legal_name", "TEXT");
    add("legal_phone", "TEXT");
    add("legal_contact_address", "TEXT");
    add("legal_email", "TEXT");
    add("enterprise_backup_name", "TEXT");
    add("enterprise_backup_phone", "TEXT");
    add("license_photo", "TEXT");
    add("created_by_user_id", "TEXT");
    add("requested_address_type", "TEXT");
    add("requested_address_region", "TEXT");
    add("group_name", "TEXT");
    add("agreement_status", "TEXT NOT NULL DEFAULT 'none'");
    add("agreement_enterprise_name", "TEXT");
    add("agreement_amount", "TEXT");
    add("agreement_service_start", "TEXT");
    add("agreement_service_end", "TEXT");
    add("agreement_submitted_at", "TEXT");
    add("agreement_reviewed_at", "TEXT");
    add("agreement_reviewer_name", "TEXT");
    add("agreement_review_comment", "TEXT");
    add("agreement_pdf_path", "TEXT");
    add("agreement_signed_path", "TEXT");
    add("agreement_completed_at", "TEXT");
}
/** 挂靠申请：业务员只填类型/区域，审批后分配 address_id；将 address_id 改为可空 */
{
    const cols = db.prepare("PRAGMA table_info(affiliation_requests)").all();
    const hasRequested = cols.some((c) => c.name === "requested_address_type");
    const addrCol = cols.find((c) => c.name === "address_id");
    const addrNotNull = addrCol?.notnull === 1;
    if (hasRequested) {
        db.exec(`
      UPDATE affiliation_requests SET
        requested_address_type = COALESCE(
          requested_address_type,
          (SELECT address_type FROM addresses WHERE addresses.id = affiliation_requests.address_id)
        ),
        requested_address_region = COALESCE(
          NULLIF(TRIM(requested_address_region), ''),
          (SELECT address_region FROM addresses WHERE addresses.id = affiliation_requests.address_id)
        )
      WHERE requested_address_type IS NULL
         OR requested_address_region IS NULL
         OR TRIM(requested_address_region) = ''
    `);
        db.exec(`
      UPDATE affiliation_requests SET address_id = NULL
      WHERE status IN ('draft', 'pending', 'rejected') AND address_id IS NOT NULL
    `);
    }
    if (!hasRequested || addrNotNull) {
        db.exec(`
      CREATE TABLE IF NOT EXISTS affiliation_requests_mig (
        id TEXT PRIMARY KEY,
        address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL,
        requested_address_type TEXT NOT NULL DEFAULT 'affiliation',
        requested_address_region TEXT NOT NULL DEFAULT '',
        applicant_name TEXT NOT NULL,
        applicant_dept TEXT NOT NULL DEFAULT '',
        service_type TEXT NOT NULL DEFAULT '地址挂靠',
        status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
        notes TEXT,
        reviewer_name TEXT,
        review_comment TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT,
        reviewed_at TEXT,
        contact_type TEXT NOT NULL DEFAULT 'direct' CHECK (contact_type IN ('channel', 'direct')),
        need_address_change INTEGER NOT NULL DEFAULT 0,
        channel_common_contact_name TEXT,
        channel_common_contact_phone TEXT,
        channel_backup_contact_name TEXT,
        channel_backup_contact_phone TEXT,
        legal_id_front TEXT,
        legal_id_back TEXT,
        legal_name TEXT,
        legal_phone TEXT,
        legal_contact_address TEXT,
        legal_email TEXT,
        enterprise_backup_name TEXT,
        enterprise_backup_phone TEXT,
        license_photo TEXT,
        created_by_user_id TEXT
      )
    `);
        db.exec(`
      INSERT INTO affiliation_requests_mig (
        id, address_id, requested_address_type, requested_address_region,
        applicant_name, applicant_dept, service_type, status, notes,
        reviewer_name, review_comment, created_at, updated_at, submitted_at, reviewed_at,
        contact_type, need_address_change,
        channel_common_contact_name, channel_common_contact_phone,
        channel_backup_contact_name, channel_backup_contact_phone,
        legal_id_front, legal_id_back, legal_name, legal_phone, legal_contact_address, legal_email,
        enterprise_backup_name, enterprise_backup_phone, license_photo, created_by_user_id
      )
      SELECT
        r.id,
        CASE WHEN r.status = 'approved' THEN r.address_id ELSE NULL END,
        COALESCE(
          r.requested_address_type,
          (SELECT address_type FROM addresses a WHERE a.id = r.address_id),
          'affiliation'
        ),
        COALESCE(
          NULLIF(TRIM(r.requested_address_region), ''),
          (SELECT address_region FROM addresses a WHERE a.id = r.address_id),
          ''
        ),
        r.applicant_name, r.applicant_dept, r.service_type, r.status, r.notes,
        r.reviewer_name, r.review_comment, r.created_at, r.updated_at, r.submitted_at, r.reviewed_at,
        r.contact_type, r.need_address_change,
        r.channel_common_contact_name, r.channel_common_contact_phone,
        r.channel_backup_contact_name, r.channel_backup_contact_phone,
        r.legal_id_front, r.legal_id_back, r.legal_name, r.legal_phone, r.legal_contact_address, r.legal_email,
        r.enterprise_backup_name, r.enterprise_backup_phone, r.license_photo, r.created_by_user_id
      FROM affiliation_requests r
    `);
        db.exec("DROP TABLE affiliation_requests");
        db.exec("ALTER TABLE affiliation_requests_mig RENAME TO affiliation_requests");
        db.exec("CREATE INDEX IF NOT EXISTS idx_affiliation_status ON affiliation_requests(status)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_affiliation_address ON affiliation_requests(address_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_affiliation_owner ON affiliation_requests(created_by_user_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_affiliation_requested ON affiliation_requests(requested_address_type, requested_address_region)");
    }
}
db.exec("CREATE INDEX IF NOT EXISTS idx_affiliation_owner ON affiliation_requests(created_by_user_id)");
const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
if (userCount === 0) {
    const t = new Date().toISOString();
    const rounds = 10;
    db.prepare(`INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?,?,?,?,?,?)`).run("user_admin", "admin", bcrypt.hashSync("admin123", rounds), "admin", "系统管理员", t);
    db.prepare(`INSERT INTO users (id, username, password_hash, role, display_name, created_at) VALUES (?,?,?,?,?,?)`).run("user_sales", "sales", bcrypt.hashSync("sales123", rounds), "sales", "业务员演示", t);
}
{
    const cols = db.prepare("PRAGMA table_info(affiliation_requests)").all();
    if (cols.some((c) => c.name === "created_by_user_id")) {
        const adm = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get();
        if (adm) {
            db.prepare("UPDATE affiliation_requests SET created_by_user_id = ? WHERE created_by_user_id IS NULL").run(adm.id);
        }
        const salesRow = db
            .prepare("SELECT id FROM users WHERE username = 'sales' COLLATE NOCASE LIMIT 1")
            .get();
        if (salesRow) {
            db.prepare("UPDATE affiliation_requests SET created_by_user_id = ? WHERE id = 'aff_demo_1'").run(salesRow.id);
        }
    }
}
const count = db.prepare("SELECT COUNT(*) AS c FROM addresses").get().c;
if (count === 0) {
    const t = new Date().toISOString();
    const a1 = "addr_demo_1";
    const a2 = "addr_demo_2";
    const a3 = "addr_demo_3";
    db.prepare(`INSERT INTO addresses (id, address_type, address_region, detail_address, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`).run(a1, "affiliation", "上海市浦东新区", "张江高科园区博云路2号A幢801室", t, t);
    db.prepare(`INSERT INTO addresses (id, address_type, address_region, detail_address, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`).run(a2, "coworking", "上海市静安区", "南京西路1266号恒隆广场二期共享工位区", t, t);
    db.prepare(`INSERT INTO addresses (id, address_type, address_region, detail_address, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`).run(a3, "business_secretary", "江苏省苏州市工业园区", "星湖街328号创意产业园商务秘书托管席位", t, t);
    const r1 = "aff_demo_1";
    db.prepare(`INSERT INTO affiliation_requests (
      id, address_id, requested_address_type, requested_address_region,
      applicant_name, applicant_dept, service_type, status, notes,
      contact_type, need_address_change,
      channel_common_contact_name, channel_common_contact_phone,
      channel_backup_contact_name, channel_backup_contact_phone,
      legal_id_front, legal_id_back, legal_name, legal_phone, legal_contact_address, legal_email,
      enterprise_backup_name, enterprise_backup_phone, license_photo,
      created_by_user_id,
      created_at, updated_at, submitted_at, reviewed_at, reviewer_name, review_comment
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(r1, null, "affiliation", "上海市浦东新区", "赵晨", "", "地址挂靠", "pending", "年度续签挂靠服务", "channel", 0, "渠道王", "13800001111", "渠道李", "13800002222", "https://example.com/id-front-demo.jpg", "https://example.com/id-back-demo.jpg", "法人张", "13900003333", "上海市浦东新区张江路1号", "zhang@example.com", "企业备周", "13900004444", null, "user_sales", t, t, t, null, null, null);
}
