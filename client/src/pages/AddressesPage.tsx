import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api";
import type { Address, AddressType } from "../types";
import { ADDRESS_TYPE_LABELS } from "../types";

export default function AddressesPage() {
  const [list, setList] = useState<Address[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Address | "new" | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.addresses
      .list({ address_type: filterType || undefined, q: q || undefined })
      .then(setList)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterType, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">地址库</h2>
          <p className="text-slate-400 text-sm mt-1">
            维护可用地址资源：地址类型、区域与详细地址。仅管理员可访问本模块。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal("new")}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 shrink-0"
        >
          新建地址
        </button>
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
          <option value="affiliation">{ADDRESS_TYPE_LABELS.affiliation}</option>
          <option value="coworking">{ADDRESS_TYPE_LABELS.coworking}</option>
          <option value="business_secretary">{ADDRESS_TYPE_LABELS.business_secretary}</option>
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
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">地址类型</th>
                <th className="px-4 py-3 font-medium">地址区域</th>
                <th className="px-4 py-3 font-medium">详细地址</th>
                <th className="px-4 py-3 font-medium w-36">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    加载中…
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                list.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-slate-700/80 text-slate-200">
                        {ADDRESS_TYPE_LABELS[row.address_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{row.address_region}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-md">{row.detail_address}</td>
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
                        onClick={async () => {
                          if (!confirm("确定删除该地址？关联的挂靠申请将一并删除。")) return;
                          await api.addresses.remove(row.id);
                          load();
                        }}
                        className="text-red-400/90 hover:text-red-300"
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
    address_type: (initial?.address_type ?? "affiliation") as AddressType,
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
          <label className="block text-xs text-slate-500">地址类型 *</label>
          <select
            value={form.address_type}
            onChange={(e) => setForm((f) => ({ ...f, address_type: e.target.value as AddressType }))}
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
          >
            <option value="affiliation">{ADDRESS_TYPE_LABELS.affiliation}</option>
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
