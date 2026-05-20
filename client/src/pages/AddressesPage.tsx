import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Address, AddressOccupancyStatus, AddressType } from "../types";
import { ADDRESS_TYPE_LABELS, addressTypeLabel } from "../types";
import AddressImportModal from "./AddressImportModal.tsx";

const occupancyStyle: Record<AddressOccupancyStatus, string> = {
  available: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  occupied: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const occupancyLabel: Record<AddressOccupancyStatus, string> = {
  available: "可领取",
  occupied: "已领取",
};

function formatReviewedAt(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

export default function AddressesPage() {
  const [list, setList] = useState<Address[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [filterOccupancy, setFilterOccupancy] = useState<"" | "available" | "occupied">("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Address | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.addresses
      .list({
        address_type: filterType || undefined,
        q: q || undefined,
        occupancy: filterOccupancy || undefined,
      })
      .then(setList)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterType, filterOccupancy, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">地址库</h2>
          <p className="text-slate-400 text-sm mt-1">
            维护地址资源；占用状态与挂靠「已通过」分配一致。已通过并占用显示为「已领取」。
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-200 text-sm font-medium px-4 py-2"
          >
            批量导入
          </button>
          <button
            type="button"
            onClick={() => setModal("new")}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2"
          >
            新建地址
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索区域、详细地址…"
          className="flex-1 min-w-[200px] rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
        >
          <option value="">全部类型</option>
          <option value="coworking">{ADDRESS_TYPE_LABELS.coworking}</option>
          <option value="business_secretary">{ADDRESS_TYPE_LABELS.business_secretary}</option>
        </select>
        <select
          value={filterOccupancy}
          onChange={(e) => setFilterOccupancy(e.target.value as "" | "available" | "occupied")}
          className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200"
        >
          <option value="">全部占用状态</option>
          <option value="available">可领取</option>
          <option value="occupied">已领取</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          查询
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[720px]">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">地址类型</th>
                <th className="px-4 py-3 font-medium">地址区域</th>
                <th className="px-4 py-3 font-medium">详细地址</th>
                <th className="px-4 py-3 font-medium min-w-[150px]">占用状态</th>
                <th className="px-4 py-3 font-medium w-36">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    加载中…
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-slate-700/80 text-slate-200">
                        {addressTypeLabel(row.address_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{row.address_region}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-md">{row.detail_address}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${occupancyStyle[row.occupancy_status]}`}
                      >
                        {occupancyLabel[row.occupancy_status]}
                      </span>
                      {row.occupancy_status === "occupied" && row.occupied_affiliation_id && (
                        <div className="mt-1.5 text-xs text-slate-500 space-y-0.5">
                          <div>
                            申请人 <span className="text-slate-300">{row.occupied_applicant_name || "—"}</span>
                          </div>
                          <Link
                            to="/affiliations"
                            className="text-sky-400 hover:text-sky-300 hover:underline"
                            title={row.occupied_affiliation_id}
                          >
                            查看挂靠申请
                            {row.occupied_reviewed_at ? ` · ${formatReviewedAt(row.occupied_reviewed_at)}` : ""}
                          </Link>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setModal(row)}
                        className="text-blue-400 hover:text-blue-300 mr-3"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        disabled={row.occupancy_status === "occupied"}
                        title={row.occupancy_status === "occupied" ? "已领取占用，请先在挂靠流程处理关联申请" : undefined}
                        onClick={async () => {
                          if (!confirm("确定删除该地址？")) return;
                          try {
                            await api.addresses.remove(row.id);
                            load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                        className="text-red-400/90 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {importOpen && (
        <AddressImportModal
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            load();
          }}
        />
      )}
      {modal && (
        <AddressModal
          initial={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddressModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Address | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    address_type: (initial?.address_type ?? "coworking") as AddressType,
    address_region: initial?.address_region ?? "",
    detail_address: initial?.detail_address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (initial) {
        await api.addresses.update(initial.id, form);
      } else {
        await api.addresses.create({
          address_type: form.address_type,
          address_region: form.address_region.trim(),
          detail_address: form.detail_address.trim(),
        });
      }
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-white">{initial ? "编辑地址" : "新建地址"}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          {initial && initial.occupancy_status === "occupied" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90 space-y-1">
              <div>当前状态：已领取</div>
              {initial.occupied_applicant_name && (
                <div>
                  关联申请：{initial.occupied_applicant_name}
                  {initial.occupied_reviewed_at ? `（${formatReviewedAt(initial.occupied_reviewed_at)}）` : ""}
                </div>
              )}
              <Link to="/affiliations" className="text-sky-400 hover:underline">
                在挂靠流程中查看
              </Link>
            </div>
          )}
          <label className="block text-xs text-slate-500">地址类型 *</label>
          <select
            value={form.address_type}
            onChange={(e) => setForm((f) => ({ ...f, address_type: e.target.value as AddressType }))}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="coworking">{ADDRESS_TYPE_LABELS.coworking}</option>
            <option value="business_secretary">{ADDRESS_TYPE_LABELS.business_secretary}</option>
          </select>
          <label className="block text-xs text-slate-500">地址区域 *</label>
          <input
            required
            value={form.address_region}
            onChange={(e) => setForm((f) => ({ ...f, address_region: e.target.value }))}
            placeholder="如：海口市江东新区"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          />
          <label className="block text-xs text-slate-500">详细地址 *</label>
          <textarea
            required
            rows={3}
            value={form.detail_address}
            onChange={(e) => setForm((f) => ({ ...f, detail_address: e.target.value }))}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
