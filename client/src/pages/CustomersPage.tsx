import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { api } from "../api";
import type { Customer, CustomerType, OaSyncResult } from "../types";
import {
  customerFormToApiBody,
  customerToForm,
  emptyCustomerForm,
  type CustomerFormState,
} from "../utils/customerMaterial";
import { validateMaterialFormFormats } from "../utils/contactFormat";

const typeLabel: Record<CustomerType, string> = {
  channel: "渠道",
  direct: "直客",
};

function inputCls() {
  return "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40";
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function CustomerFormFields({
  value,
  onChange,
}: {
  value: CustomerFormState;
  onChange: (patch: Partial<CustomerFormState>) => void;
}) {
  const isChannel = value.customer_type === "channel";
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-500 mb-1">客户类型 *</label>
        <div className="flex gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value.customer_type === "channel"}
              onChange={() => onChange({ ...emptyCustomerForm("channel"), customer_type: "channel" })}
            />
            渠道
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value.customer_type === "direct"}
              onChange={() => onChange({ ...emptyCustomerForm("direct"), customer_type: "direct" })}
            />
            直客
          </label>
        </div>
      </div>
      {isChannel ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">渠道公司名</label>
            <input
              className={inputCls()}
              value={value.channel_company_name}
              onChange={(e) => onChange({ channel_company_name: e.target.value })}
            />
          </div>
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">法人姓名 *</label>
            <input className={inputCls()} value={value.legal_name} onChange={(e) => onChange({ legal_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">法人身份证号 *</label>
            <input
              className={inputCls()}
              value={value.legal_id_number}
              onChange={(e) => onChange({ legal_id_number: e.target.value.toUpperCase() })}
              maxLength={18}
            />
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
            <input
              className={inputCls()}
              type="email"
              value={value.legal_email}
              onChange={(e) => onChange({ legal_email: e.target.value })}
            />
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
      )}
    </div>
  );
}

function CustomerModal({
  row,
  onClose,
  onSaved,
}: {
  row: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CustomerFormState>(() => (row ? customerToForm(row) : emptyCustomerForm()));
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const matLike = {
      contact_type: form.customer_type,
      channel_common_contact_phone: form.channel_common_contact_phone,
      channel_backup_contact_phone: form.channel_backup_contact_phone,
      legal_id_number: form.legal_id_number,
      legal_phone: form.legal_phone,
      legal_email: form.legal_email,
      enterprise_backup_phone: form.enterprise_backup_phone,
    };
    const formatErr = validateMaterialFormFormats(matLike, {
      requireIdNumber: form.customer_type === "direct",
    });
    if (formatErr) {
      setMsg(formatErr);
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const body = customerFormToApiBody(form);
      if (form.customer_type === "channel") {
        const dup = await api.customers.checkDuplicate({
          customer_type: "channel",
          channel_company_name: form.channel_company_name,
          channel_common_contact_phone: form.channel_common_contact_phone,
          ...(row ? { exclude_id: row.id } : {}),
        });
        if (dup.duplicate) {
          setMsg(dup.message ?? "已存在相同渠道客户");
          return;
        }
      } else {
        const dup = await api.customers.checkDuplicate({
          customer_type: "direct",
          legal_id_number: form.legal_id_number,
          ...(row ? { exclude_id: row.id } : {}),
        });
        if (dup.duplicate) {
          setMsg(dup.message ?? "已存在相同直客（法人身份证号）");
          return;
        }
      }

      if (row) {
        await api.customers.update(row.id, body);
      } else {
        await api.customers.create(body);
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
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 z-10">
          <h3 className="font-semibold text-white">{row ? "编辑客户" : "新建客户"}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-[11px] text-slate-500">仅保存文字信息，不含证件图片。渠道按「公司名+常用联系人电话」、直客按「法人身份证号」判重。</p>
          {msg && (
            <div className="rounded-lg border border-red-500/50 bg-red-950/50 px-3 py-2 text-sm text-red-200">{msg}</div>
          )}
          <CustomerFormFields value={form} onChange={(p) => setForm((prev) => ({ ...prev, ...p }))} />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CustomerType>("all");
  const [editRow, setEditRow] = useState<Customer | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState<OaSyncResult | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.customers
      .list({
        type: typeFilter === "all" ? undefined : typeFilter,
        q: searchQuery.trim() || undefined,
      })
      .then((data) => {
        setRows(data);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [typeFilter, searchQuery]);

  useEffect(() => {
    const t = window.setTimeout(load, 300);
    return () => window.clearTimeout(t);
  }, [load]);

  const summary = useMemo(() => {
    const channel = rows.filter((r) => r.customer_type === "channel").length;
    const direct = rows.filter((r) => r.customer_type === "direct").length;
    return { channel, direct, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">客户管理</h2>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            维护渠道与直客的文字档案；可从 OA 手动同步后，在挂靠申请中选择并自动带出联络人信息（不含证件照）。
            同步仅拉取 OA 中「销售负责人」为本人且具备有效电话的客户（含子表单或历史主表字段）。
            <span className="block mt-1 text-amber-400/90">
              请由管理员在「用户管理」中配置您的 OA 成员 ID（与 OA 销售负责人一致）。
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncBusy}
            onClick={async () => {
              setSyncBusy(true);
              setErr(null);
              try {
                const r = await api.customers.syncFromOa();
                setSyncResult(r);
                load();
              } catch (e) {
                const msg = (e as Error).message;
                setErr(
                  msg.includes("4004") || msg.includes("频率")
                    ? `${msg}（请勿连续点击；可等待 1 分钟后再试）`
                    : msg,
                );
              } finally {
                setSyncBusy(false);
              }
            }}
            className="px-4 py-2 text-sm rounded-lg border border-sky-600/60 bg-sky-950/40 text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
          >
            {syncBusy ? "同步中…" : "从 OA 同步"}
          </button>
          <button
            type="button"
            onClick={() => setEditRow("new")}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
          >
            新建客户
          </button>
        </div>
      </div>

      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          className={`${inputCls()} max-w-md flex-1 min-w-[200px]`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="按名称、电话、身份证号搜索…"
        />
        <div className="flex gap-1 text-sm">
          {(["all", "channel", "direct"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg border ${
                typeFilter === t
                  ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-200"
                  : "border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              {t === "all" ? "全部" : typeLabel[t]}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          共 {summary.total} 条（渠道 {summary.channel} · 直客 {summary.direct}）
        </span>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">客户</th>
                <th className="px-4 py-3">类型</th>
                <th className="px-4 py-3">来源</th>
                <th className="px-4 py-3">关键信息</th>
                {isAdmin && <th className="px-4 py-3">创建人</th>}
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    加载中…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-slate-500">
                    暂无客户，请先新建或在
                    <Link to="/affiliations" className="text-emerald-400 hover:underline mx-1">
                      挂靠流程
                    </Link>
                    中选择已有客户带出后补充建档。
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 text-white font-medium">{r.display_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                          r.customer_type === "channel"
                            ? "bg-violet-500/20 text-violet-300"
                            : "bg-sky-500/20 text-sky-300"
                        }`}
                      >
                        {typeLabel[r.customer_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.source === "oa" ? (
                        <span className="text-sky-300" title={r.oa_customer_sn ?? undefined}>
                          OA{r.oa_customer_sn ? ` · ${r.oa_customer_sn}` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-500">本地</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs">
                      {r.customer_type === "channel" ? (
                        <>
                          {r.channel_company_name && <div>{r.channel_company_name}</div>}
                          <div>
                            {r.channel_common_contact_name} · {r.channel_common_contact_phone}
                          </div>
                        </>
                      ) : (
                        <>
                          <div>{r.legal_name}</div>
                          <div>{r.legal_phone}</div>
                        </>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-slate-500 text-xs">{r.owner_display_name ?? "—"}</td>
                    )}
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatTime(r.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                          onClick={() => setEditRow(r)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="text-xs text-red-400 hover:text-red-300"
                          onClick={() => setDeleteTarget(r)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <CustomerModal
          row={editRow === "new" ? null : editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            load();
          }}
        />
      )}

      {syncResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5 max-w-md w-full space-y-3 max-h-[80vh] overflow-y-auto">
            <h3 className="font-semibold text-white">OA 同步完成</h3>
            <p className="text-sm text-slate-300">
              OA 共拉取 {syncResult.total_fetched} 条（本人负责）；新增 {syncResult.imported} 条，更新{" "}
              {syncResult.updated} 条，跳过 {syncResult.skipped} 条。
            </p>
            {syncResult.errors.length > 0 && (
              <div className="text-xs text-amber-200/90 space-y-1 max-h-40 overflow-y-auto rounded border border-amber-900/40 bg-amber-950/30 p-2">
                {syncResult.errors.slice(0, 20).map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
                {syncResult.errors.length > 20 && (
                  <p className="text-slate-500">…另有 {syncResult.errors.length - 20} 条</p>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSyncResult(null)}
                className="px-4 py-2 text-sm rounded-lg bg-slate-700 text-white hover:bg-slate-600"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-5 max-w-sm w-full space-y-4">
            <p className="text-sm text-slate-300">
              确定删除客户「{deleteTarget.display_name}」？删除后不影响已有挂靠申请记录。
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-3 py-2 text-sm border border-slate-600 rounded-lg">
                取消
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                className="px-3 py-2 text-sm rounded-lg bg-red-700 text-white disabled:opacity-50"
                onClick={async () => {
                  setDeleteBusy(true);
                  try {
                    await api.customers.remove(deleteTarget.id);
                    setDeleteTarget(null);
                    load();
                  } catch (e) {
                    setErr((e as Error).message);
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
              >
                {deleteBusy ? "删除中…" : "删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
