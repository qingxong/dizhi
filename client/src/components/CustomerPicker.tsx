import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { AffiliationContactType, Customer } from "../types";
import { customerToMaterialPatch } from "../utils/customerMaterial";

function inputCls() {
  return "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600";
}

type Props = {
  contactType: AffiliationContactType;
  onApply: (patch: ReturnType<typeof customerToMaterialPatch>) => void;
};

export function CustomerPicker({ contactType, onApply }: Props) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId("");
    setHint(null);
  }, [contactType]);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      api.customers
        .list({ type: contactType, q: q.trim() || undefined })
        .then((rows) => {
          if (!cancelled) setList(rows);
        })
        .catch(() => {
          if (!cancelled) setList([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [contactType, q]);

  const selected = useMemo(() => list.find((c) => c.id === selectedId), [list, selectedId]);

  function applyCustomer(c: Customer) {
    onApply(customerToMaterialPatch(c));
    setHint(`已带出客户「${c.display_name}」的文字信息（证件照片仍需上传）`);
  }

  return (
    <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 space-y-2">
      <div className="text-xs font-medium text-emerald-200/90">从客户档案带出</div>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        请先在「客户管理」点击「从 OA 同步」或手动建档，再在此选择客户并带出文字信息（不含证件照；OA 仅 1 位对接人时备用联系人需手填）。
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className={inputCls()}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按名称、电话搜索客户…"
        />
        <select
          className={`${inputCls()} sm:min-w-[200px]`}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={loading || list.length === 0}
        >
          <option value="">{loading ? "加载中…" : list.length === 0 ? "暂无匹配客户" : "选择客户…"}</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && applyCustomer(selected)}
          className="shrink-0 px-3 py-2 text-sm rounded-lg bg-emerald-700/80 text-white hover:bg-emerald-600 disabled:opacity-40"
        >
          带出
        </button>
      </div>
      {hint && <p className="text-[11px] text-emerald-300/90">{hint}</p>}
    </div>
  );
}
