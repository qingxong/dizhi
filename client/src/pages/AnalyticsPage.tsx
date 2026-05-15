import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { StatsResponse } from "../types";
import { ADDRESS_TYPE_LABELS, type AddressType } from "../types";

const ADDRESS_TYPES_ORDER: AddressType[] = ["affiliation", "coworking", "business_secretary"];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const maxMonth = useMemo(() => {
    if (!stats?.newAddressesLast12Months?.length) return 1;
    return Math.max(1, ...stats.newAddressesLast12Months.map((m) => m.count));
  }, [stats]);

  if (err) {
    return <p className="text-red-400 text-sm">{err}</p>;
  }
  if (!stats) {
    return <p className="text-slate-500 text-sm animate-pulse">加载统计…</p>;
  }

  const showPlatformAddressStats = stats.platformAddressStats !== false;

  const typeCounts = ADDRESS_TYPES_ORDER.map((t) => stats.addressesByType[t] ?? 0);
  const typeTotal = typeCounts.reduce((a, b) => a + b, 0) || 1;
  const typePct = typeCounts.map((c) => (c / typeTotal) * 100);
  const typeColors = ["bg-amber-500/85", "bg-emerald-500/85", "bg-violet-500/85"];

  const affTotal = Object.values(stats.affiliationsByStatus).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">统计分析</h2>
        <p className="text-slate-400 text-sm mt-1">
          {showPlatformAddressStats
            ? "资源结构、流程积压与新增趋势，辅助内部规划。"
            : "以下为当前账号创建的挂靠流程统计；全平台地址维度统计仅管理员可见。"}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {showPlatformAddressStats ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
            <h3 className="text-sm font-medium text-slate-300 mb-4">地址类型占比</h3>
            <div className="h-4 rounded-full overflow-hidden flex bg-slate-800">
              {ADDRESS_TYPES_ORDER.map((t, i) => (
                <div
                  key={t}
                  className={`${typeColors[i]} h-full transition-all`}
                  style={{ width: `${typePct[i]}%` }}
                  title={`${ADDRESS_TYPE_LABELS[t]}: ${typeCounts[i]}`}
                />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-slate-500">
              {ADDRESS_TYPES_ORDER.map((t, i) => (
                <li key={t} className="flex justify-between">
                  <span>
                    <span className={`inline-block w-2 h-2 rounded-sm mr-2 align-middle ${typeColors[i]}`} />
                    {ADDRESS_TYPE_LABELS[t]}
                  </span>
                  <strong className="text-slate-300 tabular-nums">{typeCounts[i]}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
            <h3 className="text-sm font-medium text-slate-300 mb-4">地址类型占比</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              全平台地址类型分布仅向管理员开放。您仍可查看右侧「挂靠流程」中本人申请的状态占比。
            </p>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            {showPlatformAddressStats ? "挂靠流程占比" : "我的挂靠流程占比"}
          </h3>
          <ul className="space-y-3">
            {Object.entries(stats.affiliationsByStatus).map(([k, v]) => (
              <li key={k}>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>{labelAff(k)}</span>
                  <span>
                    {v}（{Math.round((v / affTotal) * 100)}%）
                  </span>
                </div>
                <div className="h-2 rounded bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded bg-blue-500/70"
                    style={{ width: `${(v / affTotal) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
        <h3 className="text-sm font-medium text-slate-300 mb-4">近 12 个月新增地址（按月）</h3>
        {!showPlatformAddressStats ? (
          <p className="text-slate-500 text-sm leading-relaxed">
            全平台新增地址趋势仅向管理员开放。
          </p>
        ) : stats.newAddressesLast12Months.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无历史数据；录入地址后将在此聚合展示。</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {stats.newAddressesLast12Months.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full max-w-[32px] mx-auto rounded-t bg-gradient-to-t from-blue-600 to-blue-400/60"
                  style={{ height: `${(m.count / maxMonth) * 100}%`, minHeight: m.count ? 8 : 2 }}
                  title={`${m.month}: ${m.count}`}
                />
                <span className="text-[10px] text-slate-500 truncate w-full text-center">{m.month.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-5 text-sm text-slate-400">
        <strong className="text-slate-300">说明：</strong>
        统计基于本系统主数据库实时计算。
      </div>
    </div>
  );
}

function labelAff(s: string) {
  const m: Record<string, string> = {
    draft: "草稿",
    pending: "待审批",
    approved: "已通过",
    rejected: "已驳回",
  };
  return m[s] ?? s;
}
