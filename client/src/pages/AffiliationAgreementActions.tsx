import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import type { AffiliationRequest, AgreementStatus } from "../types";
import { AGREEMENT_STATUS_LABELS } from "../types";

function inputCls() {
  return "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white";
}

async function saveBlobResponse(res: Response, filename: string) {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const agreementBadge: Record<AgreementStatus, string> = {
  none: "bg-slate-700/40 text-slate-400",
  pending: "bg-violet-500/20 text-violet-300",
  pdf_ready: "bg-amber-500/20 text-amber-300",
  completed: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-red-500/20 text-red-300",
};

function normalizeAgreementStatus(s: string | undefined | null): AgreementStatus {
  if (s === "pending" || s === "pdf_ready" || s === "completed" || s === "rejected") return s;
  return "none";
}

function hasAgreementApplication(row: AffiliationRequest): boolean {
  return !!(
    row.agreement_enterprise_name?.trim() ||
    row.agreement_amount?.trim() ||
    row.agreement_service_start ||
    row.agreement_service_end
  );
}

function AgreementApplicationSummary({ row }: { row: AffiliationRequest }) {
  if (!hasAgreementApplication(row)) return null;
  return (
    <div className="rounded-md border border-slate-700/80 bg-slate-900/50 px-2 py-1.5 text-[11px] text-slate-400 space-y-0.5 max-w-[240px]">
      <div>
        <span className="text-slate-500">企业</span>{" "}
        <span className="text-slate-200 break-all">{row.agreement_enterprise_name?.trim() || "—"}</span>
      </div>
      <div>
        <span className="text-slate-500">金额</span>{" "}
        <span className="text-slate-200 tabular-nums">{row.agreement_amount?.trim() || "—"}</span>
      </div>
      <div>
        <span className="text-slate-500">服务</span>{" "}
        <span className="text-slate-200">
          {row.agreement_service_start || "—"} ~ {row.agreement_service_end || "—"}
        </span>
      </div>
      {row.agreement_submitted_at && (
        <div className="text-slate-600 pt-0.5">
          提交 {new Date(row.agreement_submitted_at).toLocaleString("zh-CN")}
        </div>
      )}
    </div>
  );
}

export function AgreementStatusBadge({ row }: { row: AffiliationRequest }) {
  if (row.status !== "approved") return <span className="text-xs text-slate-600">—</span>;
  const st = normalizeAgreementStatus(row.agreement_status);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${agreementBadge[st]}`}>
      {AGREEMENT_STATUS_LABELS[st]}
    </span>
  );
}

export function AffiliationAgreementActions({
  row,
  isAdmin,
  onReload,
  onError,
}: {
  row: AffiliationRequest;
  isAdmin: boolean;
  onReload: () => void;
  onError: (msg: string) => void;
}) {
  const [showSubmit, setShowSubmit] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [busy, setBusy] = useState(false);

  if (row.status !== "approved") {
    return <span className="text-xs text-slate-600">地址未通过</span>;
  }

  const st = normalizeAgreementStatus(row.agreement_status);

  async function downloadGenerated() {
    setBusy(true);
    try {
      const res = await api.affiliations.downloadGeneratedAgreement(row.id);
      const ext = row.agreement_pdf_path?.endsWith(".docx") ? "docx" : "pdf";
      await saveBlobResponse(res, `agreement-${row.id.slice(0, 8)}.${ext}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadSigned() {
    setBusy(true);
    try {
      const res = await api.affiliations.downloadSignedAgreement(row.id);
      const ext = row.agreement_signed_path?.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
      await saveBlobResponse(res, `signed-${row.id.slice(0, 8)}${ext}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
  <>
      <div className="flex flex-col gap-1.5 items-start">
        <AgreementStatusBadge row={row} />
        {hasAgreementApplication(row) && <AgreementApplicationSummary row={row} />}
        <div className="flex flex-wrap gap-1">
          {(st === "none" || st === "rejected") && !isAdmin && (
            <button
              type="button"
              disabled={busy}
              className="text-xs px-2 py-1 rounded bg-violet-700/70 hover:bg-violet-600/80 text-white"
              onClick={() => setShowSubmit(true)}
            >
              申请协议
            </button>
          )}
          {st === "pending" && isAdmin && (
            <>
              <button
                type="button"
                disabled={busy}
                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => setShowReview(true)}
              >
                审核详情
              </button>
              <button
                type="button"
                disabled={busy}
                className="text-xs px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600"
                onClick={() => setShowReview(true)}
              >
                通过并生成
              </button>
            </>
          )}
          {st === "pending" && !isAdmin && (
            <span className="text-xs text-slate-500">协议审核中</span>
          )}
          {(st === "pdf_ready" || (st === "completed" && row.agreement_pdf_path)) && (
            <button
              type="button"
              disabled={busy}
              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
              onClick={() => void downloadGenerated()}
            >
              下载协议
            </button>
          )}
          {st === "pdf_ready" && !isAdmin && (
            <label className="text-xs px-2 py-1 rounded bg-blue-600/85 hover:bg-blue-600 text-white cursor-pointer">
              <input
                type="file"
                className="hidden"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setBusy(true);
                  try {
                    await api.affiliations.uploadSignedAgreement(row.id, f);
                    onReload();
                  } catch (err) {
                    onError((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              回传盖章协议
            </label>
          )}
          {st === "completed" && (
            <button
              type="button"
              disabled={busy}
              className="text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => void downloadSigned()}
            >
              查看回传
            </button>
          )}
        </div>
        {st === "rejected" && row.agreement_review_comment && (
          <span className="text-[11px] text-red-400/80 max-w-[200px]">驳回：{row.agreement_review_comment}</span>
        )}
      </div>
      {showSubmit && (
        <SubmitAgreementModal
          row={row}
          onClose={() => setShowSubmit(false)}
          onDone={() => {
            setShowSubmit(false);
            onReload();
          }}
          onError={onError}
        />
      )}
      {showReview && isAdmin && (
        <AgreementReviewModal
          row={row}
          busy={busy}
          onClose={() => setShowReview(false)}
          onReload={onReload}
          onError={onError}
          setBusy={setBusy}
        />
      )}
    </>
  );
}

function AgreementReviewModal({
  row,
  busy,
  onClose,
  onReload,
  onError,
  setBusy,
}: {
  row: AffiliationRequest;
  busy: boolean;
  onClose: () => void;
  onReload: () => void;
  onError: (msg: string) => void;
  setBusy: (v: boolean) => void;
}) {
  const [comment, setComment] = useState("已生成协议");

  async function approve() {
    if (!confirm("确认审核通过并生成协议文件？")) return;
    setBusy(true);
    try {
      await api.affiliations.reviewAgreement(row.id, {
        action: "approve",
        review_comment: comment.trim() || "已生成协议",
      });
      onClose();
      onReload();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    const c = comment.trim() || "未通过";
    if (!confirm(`确认驳回该协议申请？\n原因：${c}`)) return;
    setBusy(true);
    try {
      await api.affiliations.reviewAgreement(row.id, {
        action: "reject",
        review_comment: c,
      });
      onClose();
      onReload();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-white">审核地址协议</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              申请人 {row.applicant_name}
              {row.group_name ? ` · 群 ${row.group_name}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-3 space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-slate-500 shrink-0 w-20">企业名称</span>
              <span className="text-white break-all">{row.agreement_enterprise_name?.trim() || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500 shrink-0 w-20">金额</span>
              <span className="text-white tabular-nums">{row.agreement_amount?.trim() || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500 shrink-0 w-20">服务开始</span>
              <span className="text-white">{row.agreement_service_start || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500 shrink-0 w-20">服务结束</span>
              <span className="text-white">{row.agreement_service_end || "—"}</span>
            </div>
            {row.agreement_submitted_at && (
              <div className="flex gap-2 text-xs text-slate-500 pt-1 border-t border-slate-800">
                <span className="shrink-0 w-20">提交时间</span>
                <span>{new Date(row.agreement_submitted_at).toLocaleString("zh-CN")}</span>
              </div>
            )}
          </div>
          <label className="block text-xs text-slate-500">审批意见（通过/驳回均可填写）</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} className={inputCls()} />
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void reject()}
              className="px-4 py-2 text-sm rounded-lg bg-red-900/50 text-red-200 hover:bg-red-800/60 disabled:opacity-50"
            >
              驳回
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void approve()}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "处理中…" : "通过并生成协议"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubmitAgreementModal({
  row,
  onClose,
  onDone,
  onError,
}: {
  row: AffiliationRequest;
  onClose: () => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [enterprise, setEnterprise] = useState(row.agreement_enterprise_name ?? "");
  const [amount, setAmount] = useState(row.agreement_amount ?? "");
  const [start, setStart] = useState(row.agreement_service_start ?? "");
  const [end, setEnd] = useState(row.agreement_service_end ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.affiliations.submitAgreement(row.id, {
        enterprise_name: enterprise.trim(),
        amount: amount.trim(),
        service_start: start,
        service_end: end,
      });
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-white">申请地址协议</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          <p className="text-xs text-slate-500">挂靠地址已通过，填写协议要素后提交管理员审核。</p>
          <label className="block text-xs text-slate-500">企业名称 *</label>
          <input required value={enterprise} onChange={(e) => setEnterprise(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">金额 *</label>
          <input required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls()} placeholder="如 12000" />
          <label className="block text-xs text-slate-500">服务开始时间 *</label>
          <input required type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">服务结束时间 *</label>
          <input required type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls()} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? "提交中…" : "提交审核"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
