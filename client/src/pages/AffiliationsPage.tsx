import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAuth } from "../auth/AuthContext.tsx";
import { api } from "../api";
import type { AddressChoice, AffiliationContactType, AffiliationRequest } from "../types";
import { ADDRESS_TYPE_LABELS } from "../types";

const statusStyle: Record<string, string> = {
  draft: "bg-slate-600/30 text-slate-300",
  pending: "bg-amber-500/20 text-amber-300",
  approved: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-red-500/20 text-red-300",
};

const statusText: Record<string, string> = {
  draft: "草稿",
  pending: "待审批",
  approved: "已通过",
  rejected: "已驳回",
};

const contactLabel: Record<AffiliationContactType, string> = {
  channel: "渠道",
  direct: "直客",
};

type MaterialFormState = {
  contact_type: AffiliationContactType;
  need_address_change: boolean;
  channel_common_contact_name: string;
  channel_common_contact_phone: string;
  channel_backup_contact_name: string;
  channel_backup_contact_phone: string;
  legal_id_front: string;
  legal_id_back: string;
  legal_name: string;
  legal_phone: string;
  legal_contact_address: string;
  legal_email: string;
  enterprise_backup_name: string;
  enterprise_backup_phone: string;
  license_photo: string;
};

function emptyMaterial(): MaterialFormState {
  return {
    contact_type: "direct",
    need_address_change: false,
    channel_common_contact_name: "",
    channel_common_contact_phone: "",
    channel_backup_contact_name: "",
    channel_backup_contact_phone: "",
    legal_id_front: "",
    legal_id_back: "",
    legal_name: "",
    legal_phone: "",
    legal_contact_address: "",
    legal_email: "",
    enterprise_backup_name: "",
    enterprise_backup_phone: "",
    license_photo: "",
  };
}

function rowToMaterial(r: AffiliationRequest): MaterialFormState {
  const ct: AffiliationContactType = r.contact_type === "channel" ? "channel" : "direct";
  return {
    contact_type: ct,
    need_address_change: !!(r.need_address_change ?? 0),
    channel_common_contact_name: r.channel_common_contact_name ?? "",
    channel_common_contact_phone: r.channel_common_contact_phone ?? "",
    channel_backup_contact_name: r.channel_backup_contact_name ?? "",
    channel_backup_contact_phone: r.channel_backup_contact_phone ?? "",
    legal_id_front: r.legal_id_front ?? "",
    legal_id_back: r.legal_id_back ?? "",
    legal_name: r.legal_name ?? "",
    legal_phone: r.legal_phone ?? "",
    legal_contact_address: r.legal_contact_address ?? "",
    legal_email: r.legal_email ?? "",
    enterprise_backup_name: r.enterprise_backup_name ?? "",
    enterprise_backup_phone: r.enterprise_backup_phone ?? "",
    license_photo: r.license_photo ?? "",
  };
}

function materialToApiBody(m: MaterialFormState): Record<string, unknown> {
  return {
    contact_type: m.contact_type,
    need_address_change: m.need_address_change,
    channel_common_contact_name: m.channel_common_contact_name.trim() || null,
    channel_common_contact_phone: m.channel_common_contact_phone.trim() || null,
    channel_backup_contact_name: m.channel_backup_contact_name.trim() || null,
    channel_backup_contact_phone: m.channel_backup_contact_phone.trim() || null,
    legal_id_front: m.legal_id_front.trim() || null,
    legal_id_back: m.legal_id_back.trim() || null,
    legal_name: m.legal_name.trim() || null,
    legal_phone: m.legal_phone.trim() || null,
    legal_contact_address: m.legal_contact_address.trim() || null,
    legal_email: m.legal_email.trim() || null,
    enterprise_backup_name: m.enterprise_backup_name.trim() || null,
    enterprise_backup_phone: m.enterprise_backup_phone.trim() || null,
    license_photo: m.license_photo.trim() || null,
  };
}

function inputCls() {
  return "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600";
}

/** 法人身份证正反面：仅接受文件上传，库中存 `/api/uploads/...` 路径 */
function IdPhotoInput({
  label,
  value,
  onChangeUrl,
}: {
  label: string;
  value: string;
  onChangeUrl: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const isUploadPath = value.startsWith("/api/uploads/");
  const isLegacyHttp = /^https?:\/\//i.test(value);
  const showPreview = value && (isUploadPath || isLegacyHttp);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setLocalErr(null);
    try {
      const { url } = await api.affiliations.uploadIdPhoto(file);
      onChangeUrl(url);
    } catch (err) {
      setLocalErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="block text-[11px] text-slate-500">{label}</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => void onPick(e)}
        className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white file:text-xs"
      />
      {busy && <p className="text-[11px] text-slate-500">上传中…</p>}
      {localErr && <p className="text-[11px] text-red-400">{localErr}</p>}
      {value && !isUploadPath && !isLegacyHttp && (
        <p className="text-[11px] text-amber-400/90">
          当前为历史文本记录，请重新选择图片文件上传以替换。
        </p>
      )}
      {showPreview && (
        <div className="flex flex-wrap items-start gap-2 pt-1">
          <img
            src={value}
            alt=""
            className="max-h-36 rounded border border-slate-700 object-contain bg-black/20"
          />
          {!busy && (
            <button
              type="button"
              className="text-[11px] text-amber-400 hover:text-amber-300 shrink-0"
              onClick={() => onChangeUrl("")}
            >
              清除并重新上传
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MaterialFormBody({
  value,
  onChange,
}: {
  value: MaterialFormState;
  onChange: (patch: Partial<MaterialFormState>) => void;
}) {
  const isChannel = value.contact_type === "channel";
  return (
    <div className="space-y-4 border-t border-slate-800 pt-4 mt-1">
      <h4 className="text-sm font-medium text-white">地址领取 · 联络人与材料</h4>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        法人身份证正反面须上传图片文件（JPEG / PNG / WebP，单张不超过 8MB）。办理地址变更时的执照仍可填链接或说明。
      </p>
      <div>
        <label className="block text-xs text-slate-500 mb-1">联络人类型 *</label>
        <div className="flex gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contact_type"
              checked={value.contact_type === "channel"}
              onChange={() => onChange({ contact_type: "channel" })}
            />
            渠道
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contact_type"
              checked={value.contact_type === "direct"}
              onChange={() => onChange({ contact_type: "direct" })}
            />
            直客
          </label>
        </div>
      </div>
      {isChannel && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
          <div className="text-xs font-medium text-violet-300/90">渠道材料</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">常用联系人姓名 *</label>
              <input
                className={inputCls()}
                value={value.channel_common_contact_name}
                onChange={(e) => onChange({ channel_common_contact_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">常用联系人电话 *</label>
              <input
                className={inputCls()}
                value={value.channel_common_contact_phone}
                onChange={(e) => onChange({ channel_common_contact_phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">备用联系人姓名 *</label>
              <input
                className={inputCls()}
                value={value.channel_backup_contact_name}
                onChange={(e) => onChange({ channel_backup_contact_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">备用联系人电话 *</label>
              <input
                className={inputCls()}
                value={value.channel_backup_contact_phone}
                onChange={(e) => onChange({ channel_backup_contact_phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
        <div className="text-xs font-medium text-sky-300/90">企业法人及企业备用联系人</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IdPhotoInput
            label="法人身份证正面 *"
            value={value.legal_id_front}
            onChangeUrl={(url) => onChange({ legal_id_front: url })}
          />
          <IdPhotoInput
            label="法人身份证反面 *"
            value={value.legal_id_back}
            onChangeUrl={(url) => onChange({ legal_id_back: url })}
          />
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">法人姓名 *</label>
            <input className={inputCls()} value={value.legal_name} onChange={(e) => onChange({ legal_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">法人手机号 *</label>
            <input className={inputCls()} value={value.legal_phone} onChange={(e) => onChange({ legal_phone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">法人联系地址 *</label>
            <input
              className={inputCls()}
              value={value.legal_contact_address}
              onChange={(e) => onChange({ legal_contact_address: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">法人邮箱 *</label>
            <input className={inputCls()} value={value.legal_email} onChange={(e) => onChange({ legal_email: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">企业备用联系人姓名 *</label>
            <input
              className={inputCls()}
              value={value.enterprise_backup_name}
              onChange={(e) => onChange({ enterprise_backup_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">企业备用联系人电话 *</label>
            <input
              className={inputCls()}
              value={value.enterprise_backup_phone}
              onChange={(e) => onChange({ enterprise_backup_phone: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={value.need_address_change}
            onChange={(e) => onChange({ need_address_change: e.target.checked })}
          />
          用于办理地址变更（需上传执照照片）
        </label>
        {value.need_address_change && (
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">执照照片 *</label>
            <input
              className={inputCls()}
              placeholder="链接或说明"
              value={value.license_photo}
              onChange={(e) => onChange({ license_photo: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AffiliationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<AffiliationRequest[]>([]);
  const [addressChoices, setAddressChoices] = useState<AddressChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editRow, setEditRow] = useState<AffiliationRequest | null>(null);
  const [viewRow, setViewRow] = useState<AffiliationRequest | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.affiliations.list(), api.addressChoices.list()])
      .then(([a, b]) => {
        setRows(a);
        setAddressChoices(b);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">地址挂靠流程</h2>
          <p className="text-slate-400 text-sm mt-1">
            申请需区分渠道/直客并填写材料清单；草稿或已驳回可编辑后提交。已驳回可先「修改」再「重新提交」。
            {!isAdmin && <span className="text-slate-500"> 审批通过/驳回仅管理员可操作。</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2"
        >
          新建申请
        </button>
      </div>

      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[920px]">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">关联地址</th>
                <th className="px-4 py-3 font-medium">申请人</th>
                <th className="px-4 py-3 font-medium">联络</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">时间线</th>
                <th className="px-4 py-3 font-medium w-64">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    加载中…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    暂无申请
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="text-xs text-violet-300/90 font-medium">
                        {ADDRESS_TYPE_LABELS[r.address_type]}
                      </div>
                      <div className="text-white font-medium mt-0.5">{r.address_region}</div>
                      <div className="text-slate-500 text-xs mt-0.5 truncate max-w-[280px]" title={r.detail_address}>
                        {r.detail_address}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {r.applicant_name}
                      <div className="text-xs text-slate-500">{r.applicant_dept}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <span className="text-slate-300">{contactLabel[r.contact_type === "channel" ? "channel" : "direct"]}</span>
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
                          onClick={() => setViewRow(r)}
                        >
                          查看材料
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[r.status]}`}>
                        {statusText[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 space-y-0.5">
                      <div>创建 {formatTime(r.created_at)}</div>
                      {r.submitted_at && <div>提交 {formatTime(r.submitted_at)}</div>}
                      {r.reviewed_at && (
                        <div>
                          审批 {formatTime(r.reviewed_at)} {r.reviewer_name ? `· ${r.reviewer_name}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.status === "draft" && (
                          <>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                              onClick={() => setEditRow(r)}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-amber-700/70 hover:bg-amber-600/80"
                              onClick={async () => {
                                try {
                                  await api.affiliations.patch(r.id, { action: "submit" });
                                  load();
                                } catch (e) {
                                  setErr((e as Error).message);
                                }
                              }}
                            >
                              提交审批
                            </button>
                            <button
                              type="button"
                              className="text-xs text-red-400 hover:text-red-300"
                              onClick={async () => {
                                if (!confirm("删除该草稿？")) return;
                                await api.affiliations.remove(r.id);
                                load();
                              }}
                            >
                              删除
                            </button>
                          </>
                        )}
                        {r.status === "pending" && isAdmin && (
                          <>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600"
                              onClick={async () => {
                                const c = prompt("审批意见（可留空）", "同意");
                                if (c === null) return;
                                await api.affiliations.patch(r.id, {
                                  action: "approve",
                                  review_comment: c,
                                });
                                load();
                              }}
                            >
                              通过
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/60"
                              onClick={async () => {
                                const c = prompt("驳回原因", "");
                                if (c === null) return;
                                await api.affiliations.patch(r.id, {
                                  action: "reject",
                                  review_comment: c || "未填写原因",
                                });
                                load();
                              }}
                            >
                              驳回
                            </button>
                          </>
                        )}
                        {r.status === "pending" && !isAdmin && (
                          <span className="text-xs text-slate-500">待管理员审批</span>
                        )}
                        {r.status === "approved" && (
                          <span className="text-xs text-slate-600">{r.review_comment || "—"}</span>
                        )}
                        {r.status === "rejected" && (
                          <div className="flex flex-col gap-1.5 items-start max-w-[260px]">
                            <span className="text-xs text-slate-500">
                              驳回意见：{r.review_comment || "—"}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                                onClick={() => setEditRow(r)}
                              >
                                修改
                              </button>
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded bg-blue-600/85 hover:bg-blue-600 text-white"
                                onClick={async () => {
                                  if (!confirm("确认再次提交审批？状态将变为「待审批」，管理员可重新审核。")) return;
                                  try {
                                    await api.affiliations.patch(r.id, { action: "resubmit" });
                                    load();
                                  } catch (e) {
                                    setErr((e as Error).message);
                                  }
                                }}
                              >
                                重新提交
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewAffiliationModal
          addressChoices={addressChoices}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
      {editRow && (
        <EditAffiliationModal
          key={editRow.id}
          row={editRow}
          addressChoices={addressChoices}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            load();
          }}
        />
      )}
      {viewRow && <ViewMaterialModal row={viewRow} onClose={() => setViewRow(null)} />}
    </div>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
      d.getHours(),
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-sm text-slate-200 break-all">{value && String(value).trim() ? value : "—"}</div>
    </div>
  );
}

function IdPhotoReadonly({ label, url }: { label: string; url: string | null | undefined }) {
  const v = url?.trim();
  if (!v) {
    return <Field label={label} value={null} />;
  }
  const asImg = v.startsWith("/api/") || /^https?:\/\//i.test(v);
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      {asImg ? (
        <img src={v} alt="" className="mt-1 max-h-44 rounded border border-slate-700 object-contain bg-black/20" />
      ) : (
        <div className="text-sm text-slate-200 break-all">{v}</div>
      )}
    </div>
  );
}

function ViewMaterialModal({ row, onClose }: { row: AffiliationRequest; onClose: () => void }) {
  const ct: AffiliationContactType = row.contact_type === "channel" ? "channel" : "direct";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 backdrop-blur">
          <div>
            <h3 className="font-semibold text-white">材料与联络人</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {contactLabel[ct]} · 申请人 {row.applicant_name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none shrink-0">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          {ct === "channel" && (
            <div className="rounded-lg border border-slate-800 p-3 space-y-2">
              <div className="text-xs font-medium text-violet-300/90">渠道</div>
              <Field label="常用联系人姓名" value={row.channel_common_contact_name} />
              <Field label="常用联系人电话" value={row.channel_common_contact_phone} />
              <Field label="备用联系人姓名" value={row.channel_backup_contact_name} />
              <Field label="备用联系人电话" value={row.channel_backup_contact_phone} />
            </div>
          )}
          <div className="rounded-lg border border-slate-800 p-3 space-y-2">
            <div className="text-xs font-medium text-sky-300/90">法人与企业备用联系人</div>
            <IdPhotoReadonly label="法人身份证正面" url={row.legal_id_front} />
            <IdPhotoReadonly label="法人身份证反面" url={row.legal_id_back} />
            <Field label="法人姓名" value={row.legal_name} />
            <Field label="法人手机" value={row.legal_phone} />
            <Field label="法人联系地址" value={row.legal_contact_address} />
            <Field label="法人邮箱" value={row.legal_email} />
            <Field label="企业备用联系人姓名" value={row.enterprise_backup_name} />
            <Field label="企业备用联系人电话" value={row.enterprise_backup_phone} />
          </div>
          <div className="rounded-lg border border-slate-800 p-3 space-y-2">
            <div className="text-xs font-medium text-slate-400">地址变更</div>
            <div className="text-slate-300">{row.need_address_change ? "是 · 需提供执照" : "否"}</div>
            {!!row.need_address_change && <Field label="执照照片" value={row.license_photo} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditAffiliationModal({
  row,
  addressChoices,
  onClose,
  onSaved,
}: {
  row: AffiliationRequest;
  addressChoices: AddressChoice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDraft = row.status === "draft";
  const [addressId, setAddressId] = useState(row.address_id);
  const [applicantName, setApplicantName] = useState(row.applicant_name);
  const [applicantDept, setApplicantDept] = useState(row.applicant_dept);
  const [serviceType, setServiceType] = useState(row.service_type || "地址挂靠");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [mat, setMat] = useState<MaterialFormState>(() => rowToMaterial(row));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const basePayload = () => ({
    address_id: addressId,
    applicant_name: applicantName.trim(),
    applicant_dept: applicantDept.trim(),
    service_type: serviceType.trim() || "地址挂靠",
    notes: notes.trim() || null,
    ...materialToApiBody(mat),
  });

  async function saveDraft(e: FormEvent) {
    e.preventDefault();
    if (!addressId) {
      setMsg("请选择关联地址");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.affiliations.patch(row.id, basePayload());
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSubmit() {
    if (!addressId) {
      setMsg("请选择关联地址");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      if (isDraft) {
        await api.affiliations.patch(row.id, { ...basePayload(), action: "submit" });
      } else {
        await api.affiliations.patch(row.id, { ...basePayload(), action: "resubmit" });
      }
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <div>
            <h3 className="font-semibold text-white">{isDraft ? "编辑草稿" : "修改申请"}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isDraft ? "保存后可点「保存并提交审批」；材料按清单校验。" : "保存后请在列表中点「重新提交」送审，或在此一键保存并重新提交。"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none shrink-0">
            ×
          </button>
        </div>
        <form onSubmit={saveDraft} className="p-5 space-y-3">
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          {!isDraft && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
              <span className="text-slate-500">上次驳回：</span>
              {row.review_comment || "—"}
            </div>
          )}
          <label className="block text-xs text-slate-500">关联地址 *</label>
          <select
            required
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            className={inputCls()}
          >
            {addressChoices.length === 0 ? (
              <option value="">无可用地址</option>
            ) : (
              addressChoices.map((a) => (
                <option key={a.id} value={a.id}>
                  {ADDRESS_TYPE_LABELS[a.address_type]} · {a.address_region} ·{" "}
                  {a.detail_address.length > 36 ? `${a.detail_address.slice(0, 36)}…` : a.detail_address}
                </option>
              ))
            )}
          </select>
          <label className="block text-xs text-slate-500">申请人 *</label>
          <input required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">申请部门 *</label>
          <input required value={applicantDept} onChange={(e) => setApplicantDept(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">服务类型</label>
          <input
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className={inputCls()}
            placeholder="如：地址挂靠"
          />
          <label className="block text-xs text-slate-500">说明</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls()} />
          <MaterialFormBody value={mat} onChange={(p) => setMat((prev) => ({ ...prev, ...p }))} />
          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !addressChoices.length}
              className="px-4 py-2 text-sm rounded-lg bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50"
            >
              {saving ? "保存中…" : "仅保存"}
            </button>
            <button
              type="button"
              disabled={saving || !addressChoices.length}
              onClick={() => void saveAndSubmit()}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "处理中…" : isDraft ? "保存并提交审批" : "保存并重新提交"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewAffiliationModal({
  addressChoices,
  onClose,
  onCreated,
}: {
  addressChoices: AddressChoice[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [addressId, setAddressId] = useState(addressChoices[0]?.id ?? "");
  const [applicantName, setApplicantName] = useState("");
  const [applicantDept, setApplicantDept] = useState("");
  const [serviceType, setServiceType] = useState("地址挂靠");
  const [notes, setNotes] = useState("");
  const [mat, setMat] = useState<MaterialFormState>(emptyMaterial);
  const [submitNow, setSubmitNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!addressId) {
      setMsg("暂无可选地址，请联系管理员在地址库中维护地址资源");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.affiliations.create({
        address_id: addressId,
        applicant_name: applicantName,
        applicant_dept: applicantDept,
        service_type: serviceType.trim() || "地址挂靠",
        notes: notes || undefined,
        status: submitNow ? "pending" : undefined,
        ...materialToApiBody(mat),
      });
      onCreated();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <h3 className="font-semibold text-white">新建挂靠申请</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          <label className="block text-xs text-slate-500">关联地址 *</label>
          <select
            required
            value={addressId}
            onChange={(e) => setAddressId(e.target.value)}
            className={inputCls()}
          >
            {addressChoices.length === 0 ? (
              <option value="">无可用地址</option>
            ) : (
              addressChoices.map((a) => (
                <option key={a.id} value={a.id}>
                  {ADDRESS_TYPE_LABELS[a.address_type]} · {a.address_region} ·{" "}
                  {a.detail_address.length > 36 ? `${a.detail_address.slice(0, 36)}…` : a.detail_address}
                </option>
              ))
            )}
          </select>
          <label className="block text-xs text-slate-500">申请人 *</label>
          <input
            required
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            className={inputCls()}
          />
          <label className="block text-xs text-slate-500">申请部门 *</label>
          <input
            required
            value={applicantDept}
            onChange={(e) => setApplicantDept(e.target.value)}
            className={inputCls()}
            placeholder="如：法务合规部"
          />
          <label className="block text-xs text-slate-500">服务类型</label>
          <input value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">说明</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls()} />
          <MaterialFormBody value={mat} onChange={(p) => setMat((prev) => ({ ...prev, ...p }))} />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} />
            创建后直接提交审批（将校验材料必填项）
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !addressChoices.length}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? "提交中…" : "确定"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
