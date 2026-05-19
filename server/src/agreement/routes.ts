import type { Request, Response, Router } from "express";
import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import multer from "multer";
import {
  AGREEMENT_PLACEHOLDERS,
  AGREEMENT_STATUS_LABELS,
  type AgreementStatus,
} from "./constants.js";
import {
  buildAgreementTemplateData,
  generateAgreementDocument,
  resolveUnderUploads,
  saveUploadedTemplate,
  templateFileInfo,
} from "./generate.js";
import { AGREEMENT_TEMPLATE_FILE } from "./paths.js";
import { agreementSignedMulter, agreementTemplateMulter, signedPathForAffiliation } from "./upload.js";

type SqlParam = string | number | bigint | null;

function routeId(p: string | string[] | undefined): string {
  if (p == null) return "";
  return typeof p === "string" ? p : (p[0] ?? "");
}

function nowIso() {
  return new Date().toISOString();
}

type AffRow = {
  id: string;
  status: string;
  created_by_user_id?: string | null;
  agreement_status?: string;
};

export function registerAgreementRoutes(
  api: Router,
  deps: {
    db: { prepare: (sql: string) => { get: (...a: SqlParam[]) => unknown; run: (...a: SqlParam[]) => unknown } };
    requireAdmin: (req: Request, res: Response, next: () => void) => void;
    canAccessAffiliationRow: (req: Request, row: { created_by_user_id?: string | null }) => boolean;
    affiliationRowSelect: string;
  },
) {
  const { db, requireAdmin, canAccessAffiliationRow, affiliationRowSelect } = deps;

  const getAff = (id: string) =>
    db.prepare(`${affiliationRowSelect} WHERE r.id = ?`).get(id) as Record<string, unknown> | undefined;

  api.get("/agreement-template/placeholders", (_req, res) => {
    res.json({ placeholders: AGREEMENT_PLACEHOLDERS, status_labels: AGREEMENT_STATUS_LABELS });
  });

  api.get("/agreement-template/info", (_req, res) => {
    const info = templateFileInfo();
    res.json({
      ...info,
      sample_data: buildAgreementTemplateData({
        id: "SAMPLE0001",
        agreement_enterprise_name: "示例科技有限公司",
        agreement_amount: "12000",
        agreement_service_start: "2026-01-01",
        agreement_service_end: "2026-12-31",
        legal_name: "张三",
        legal_phone: "13800138000",
        legal_contact_address: "海南省海口市示例路 1 号",
        legal_email: "demo@example.com",
        applicant_name: "李业务",
        group_name: "示例服务群",
        address_type: "affiliation",
        address_region: "海南省海口市",
        detail_address: "海南省海口市示例区示例街道 88 号",
        service_type: "地址挂靠",
      }),
    });
  });

  api.get("/agreement-template/download", requireAdmin, (_req, res) => {
    if (!existsSync(AGREEMENT_TEMPLATE_FILE)) {
      return res.status(404).json({ error: "尚未上传模板" });
    }
    res.download(AGREEMENT_TEMPLATE_FILE, "agreement-template.docx");
  });

  api.post(
    "/agreement-template",
    requireAdmin,
    (req, res, next) => {
      agreementTemplateMulter.single("file")(req, res, (err: unknown) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "模板不超过 15MB" : err.message });
          }
          return res.status(400).json({ error: (err as Error).message || "上传失败" });
        }
        next();
      });
    },
    (req, res) => {
      const f = req.file;
      if (!f) return res.status(400).json({ error: "请选择 .docx 模板文件" });
      try {
        saveUploadedTemplate(f.path);
        try {
          unlinkSync(f.path);
        } catch {
          /* temp cleanup */
        }
        res.json(templateFileInfo());
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    },
  );

  api.post("/affiliations/:id/agreement/submit", (req, res) => {
    const id = routeId(req.params.id);
    const row = getAff(id) as AffRow | undefined;
    if (!row) return res.status(404).json({ error: "未找到申请" });
    if (!canAccessAffiliationRow(req, row)) return res.status(403).json({ error: "无权操作该申请" });
    if (row.status !== "approved") {
      return res.status(400).json({ error: "仅地址审批通过后可申请协议" });
    }
    const st = (row.agreement_status ?? "none") as AgreementStatus;
    if (st !== "none" && st !== "rejected") {
      return res.status(400).json({ error: "当前协议状态不可再次提交" });
    }

    const b = req.body as Record<string, unknown>;
    const enterprise = String(b?.enterprise_name ?? "").trim();
    const amount = String(b?.amount ?? "").trim();
    const serviceStart = String(b?.service_start ?? "").trim();
    const serviceEnd = String(b?.service_end ?? "").trim();
    if (!enterprise) return res.status(400).json({ error: "请填写企业名称" });
    if (!amount) return res.status(400).json({ error: "请填写金额" });
    if (!serviceStart || !serviceEnd) return res.status(400).json({ error: "请填写服务开始与结束时间" });
    if (serviceEnd < serviceStart) return res.status(400).json({ error: "服务结束时间不能早于开始时间" });

    const t = nowIso();
    db.prepare(
      `UPDATE affiliation_requests SET
        agreement_status = 'pending',
        agreement_enterprise_name = ?, agreement_amount = ?,
        agreement_service_start = ?, agreement_service_end = ?,
        agreement_submitted_at = ?, agreement_reviewed_at = NULL,
        agreement_reviewer_name = NULL, agreement_review_comment = NULL,
        agreement_pdf_path = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(enterprise, amount, serviceStart, serviceEnd, t, t, id);

    res.json(getAff(id));
  });

  api.patch("/affiliations/:id/agreement/review", requireAdmin, async (req, res) => {
    const id = routeId(req.params.id);
    const row = getAff(id);
    if (!row) return res.status(404).json({ error: "未找到申请" });
    if ((row.agreement_status as string) !== "pending") {
      return res.status(400).json({ error: "仅协议待审状态可审核" });
    }

    const action = req.body?.action;
    const t = nowIso();
    const reviewer = req.session?.displayName || req.session?.username || "管理员";

    if (action === "reject") {
      const comment = req.body?.review_comment != null ? String(req.body.review_comment) : "未通过";
      db.prepare(
        `UPDATE affiliation_requests SET agreement_status = 'rejected',
         agreement_reviewer_name = ?, agreement_review_comment = ?, agreement_reviewed_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(reviewer, comment, t, t, id);
      return res.json(getAff(id));
    }

    if (action !== "approve") {
      return res.status(400).json({ error: "action 须为 approve 或 reject" });
    }

    try {
      const { relativePath } = await generateAgreementDocument(id, row as Parameters<typeof generateAgreementDocument>[1]);
      const comment =
        req.body?.review_comment != null && String(req.body.review_comment).trim() !== ""
          ? String(req.body.review_comment)
          : "协议已生成";
      db.prepare(
        `UPDATE affiliation_requests SET agreement_status = 'pdf_ready',
         agreement_pdf_path = ?, agreement_reviewer_name = ?, agreement_review_comment = ?,
         agreement_reviewed_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(relativePath, reviewer, comment, t, t, id);
      const updated = getAff(id) as Record<string, unknown>;
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  api.get("/affiliations/:id/agreement/generated", (req, res) => {
    const id = routeId(req.params.id);
    const row = getAff(id) as AffRow & { agreement_pdf_path?: string | null };
    if (!row) return res.status(404).json({ error: "未找到申请" });
    if (!canAccessAffiliationRow(req, row)) return res.status(403).json({ error: "无权查看" });
    const rel = row.agreement_pdf_path;
    if (!rel || (row.agreement_status !== "pdf_ready" && row.agreement_status !== "completed")) {
      return res.status(404).json({ error: "协议文件尚未生成" });
    }
    const abs = resolveUnderUploads(rel);
    if (!existsSync(abs)) return res.status(404).json({ error: "协议文件不存在" });
    const name = rel.endsWith(".pdf") ? "agreement.pdf" : "agreement.docx";
    res.download(abs, name);
  });

  api.get("/affiliations/:id/agreement/signed", (req, res) => {
    const id = routeId(req.params.id);
    const row = getAff(id) as AffRow & { agreement_signed_path?: string | null };
    if (!row) return res.status(404).json({ error: "未找到申请" });
    if (!canAccessAffiliationRow(req, row)) return res.status(403).json({ error: "无权查看" });
    const rel = row.agreement_signed_path;
    if (!rel || row.agreement_status !== "completed") {
      return res.status(404).json({ error: "尚未回传盖章协议" });
    }
    const abs = resolveUnderUploads(rel);
    if (!existsSync(abs)) return res.status(404).json({ error: "文件不存在" });
    res.download(abs, "signed-agreement.pdf");
  });

  api.post(
    "/affiliations/:id/agreement/signed",
    (req, res, next) => {
      agreementSignedMulter.single("file")(req, res, (err: unknown) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "PDF 不超过 25MB" : err.message });
          }
          return res.status(400).json({ error: (err as Error).message || "上传失败" });
        }
        next();
      });
    },
    (req, res) => {
      const id = routeId(req.params.id);
      const row = getAff(id) as AffRow | undefined;
      if (!row) return res.status(404).json({ error: "未找到申请" });
      if (!canAccessAffiliationRow(req, row)) return res.status(403).json({ error: "无权操作该申请" });
      if ((row.agreement_status as string) !== "pdf_ready") {
        return res.status(400).json({ error: "请先生成协议并待客户盖章后再回传" });
      }
      const f = req.file;
      if (!f) return res.status(400).json({ error: "请选择盖章后的 PDF 协议" });

      const dest = signedPathForAffiliation(id);
      try {
        copyFileSync(f.path, dest);
        try {
          unlinkSync(f.path);
        } catch {
          /* */
        }
      } catch (e) {
        return res.status(500).json({ error: (e as Error).message });
      }

      const rel = `agreements/signed/${id}.pdf`;
      const t = nowIso();
      db.prepare(
        `UPDATE affiliation_requests SET agreement_status = 'completed',
         agreement_signed_path = ?, agreement_completed_at = ?, updated_at = ?
         WHERE id = ?`,
      ).run(rel, t, t, id);

      res.json(getAff(id));
    },
  );
}
