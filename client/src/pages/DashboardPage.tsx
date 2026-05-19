import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.tsx";
import { api } from "../api";
import type { StatsResponse } from "../types";
import { ADDRESS_TYPE_LABELS } from "../types";

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e: Error) => setErr(e.message));
  }, []);

  if (err) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 text-red-200">
        无法加载统计数据：{err}。请确认已启动后端服务（根目录执行 <code className="text-red-100">npm run dev</code>）。
      </div>
    );
  }

  if (!stats) {
    return <div className="text-slate-500 text-sm animate-pulse">加载中…</div>;
  }

  const showPlatformAddressStats = stats.platformAddressStats !== false;
  const myAffiliationTotal = Object.values(stats.affiliationsByStatus).reduce((a, b) => a + b, 0);

  const aff = stats.addressesByType["affiliation"] ?? 0;
  const cow = stats.addressesByType["coworking"] ?? 0;
  const sec = stats.addressesByType["business_secretary"] ?? 0;

  const cardBase =
    "group rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-600 hover:bg-slate-900/70 transition-all block";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">工作台</h2>
        <p className="text-slate-400 text-sm mt-1">
          {showPlatformAddressStats
            ? "快速掌握地址资源与挂靠审批负荷。"
            : "以下为当前账号创建的挂靠申请统计；全平台地址资源仅管理员可见。"}
        </p>
      </div>

      <div className={`grid sm:grid-cols-2 gap-4 ${showPlatformAddressStats ? "lg:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-3"}`}>
        {isAdmin ? (
          <Link to="/addresses" className={cardBase}>
            <p className="text-xs uppercase tracking-wide text-slate-500">地址资源总数</p>
            <p className="text-3xl font-semibold text-white mt-2 tabular-nums">{stats.totalAddresses}</p>
            <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-400">进入地址库维护 →</p>
          </Link>
        ) : showPlatformAddressStats ? (
          <div className={cardBase + " cursor-default hover:border-slate-800"}>
            <p className="text-xs uppercase tracking-wide text-slate-500">地址资源总数</p>
            <p className="text-3xl font-semibold text-white mt-2 tabular-nums">{stats.totalAddresses}</p>
            <p className="text-xs text-slate-600 mt-2">地址库仅管理员可维护</p>
          </div>
        ) : (
          <Link to="/affiliations" className={cardBase}>
            <p className="text-xs uppercase tracking-wide text-slate-500">我的挂靠申请</p>
            <p className="text-3xl font-semibold text-white mt-2 tabular-nums">{myAffiliationTotal}</p>
            <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-400">查看我的申请列表 →</p>
          </Link>
        )}
        <Link to="/affiliations" className={cardBase}>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {showPlatformAddressStats ? "待审批挂靠" : "我的待审批申请"}
          </p>
          <p className="text-3xl font-semibold text-white mt-2 tabular-nums">{stats.pendingApprovals}</p>
          <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-400">需及时处理 →</p>
        </Link>
        <Link to="/affiliations" className={cardBase}>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {showPlatformAddressStats ? "待审批协议" : "我的协议待审"}
          </p>
          <p className="text-3xl font-semibold text-violet-300 mt-2 tabular-nums">
            {stats.pendingAgreementApprovals ?? 0}
          </p>
          <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-400">进入挂靠流程 →</p>
        </Link>
        {showPlatformAddressStats ? (
          <>
            <TypeStatCard title={ADDRESS_TYPE_LABELS.affiliation} count={aff} admin={isAdmin} />
            <TypeStatCard
              title={`${ADDRESS_TYPE_LABELS.coworking} / ${ADDRESS_TYPE_LABELS.business_secretary}`}
              count={cow + sec}
              admin={isAdmin}
            />
          </>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <h3 className="text-sm font-medium text-slate-300 mb-4">
            {stats.platformAddressStats === false ? "我的挂靠申请状态" : "挂靠申请状态分布"}
          </h3>
          <ul className="space-y-2">
            {Object.entries(stats.affiliationsByStatus).map(([k, v]) => (
              <li key={k} className="flex justify-between text-sm">
                <span className="text-slate-400">{statusLabel(k)}</span>
                <span className="text-white font-medium tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
          <Link to="/affiliations" className="inline-block mt-4 text-sm text-blue-400 hover:text-blue-300">
            进入流程管理 →
          </Link>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6">
          <h3 className="text-sm font-medium text-slate-300 mb-4">常用入口</h3>
          <div className="flex flex-col gap-2">
            {isAdmin && (
              <Link
                to="/addresses"
                className="rounded-lg border border-slate-700/80 px-4 py-3 text-sm hover:bg-slate-800/60"
              >
                地址库：维护地址类型、区域与详细地址
              </Link>
            )}
            <Link
              to="/analytics"
              className="rounded-lg border border-slate-700/80 px-4 py-3 text-sm hover:bg-slate-800/60"
            >
              查看统计与近 12 个月新增趋势
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypeStatCard({ title, count, admin }: { title: string; count: number; admin: boolean }) {
  if (admin) {
    return (
      <Link to="/addresses" className="group rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-600 hover:bg-slate-900/70 transition-all block">
        <p className="text-xs uppercase tracking-wide text-slate-500 line-clamp-2">{title}</p>
        <p className="text-3xl font-semibold text-white mt-2 tabular-nums">{count}</p>
        <p className="text-xs text-slate-500 mt-2 group-hover:text-slate-400">按类型筛选 →</p>
      </Link>
    );
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-xs uppercase tracking-wide text-slate-500 line-clamp-2">{title}</p>
      <p className="text-3xl font-semibold text-white mt-2 tabular-nums">{count}</p>
      <p className="text-xs text-slate-600 mt-2">仅展示</p>
    </div>
  );
}

function statusLabel(s: string) {
  const m: Record<string, string> = {
    draft: "草稿",
    pending: "待审批",
    approved: "已通过",
    rejected: "已驳回",
  };
  return m[s] ?? s;
}
