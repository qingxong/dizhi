import type { FormEvent } from "react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await login(username.trim(), password);
      navigate(from === "/login" ? "/" : from, { replace: true });
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0b0f14] text-slate-100">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl">
        <h1 className="text-lg font-semibold text-white text-center">企业地址管理</h1>
        <p className="text-xs text-slate-500 text-center mt-1 mb-6">请使用内部分配账号登录</p>
        <form onSubmit={onSubmit} className="space-y-4">
          {err && <p className="text-sm text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">{err}</p>}
          <div>
            <label className="block text-xs text-slate-500 mb-1">用户名</label>
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">密码</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              required
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5"
          >
            {pending ? "登录中…" : "登录"}
          </button>
        </form>
        <p className="text-[11px] text-slate-600 mt-6 leading-relaxed">
          演示账号：管理员 <code className="text-slate-400">admin</code> / <code className="text-slate-400">admin123</code>
          ；业务员 <code className="text-slate-400">sales</code> / <code className="text-slate-400">sales123</code>
          。生产环境请修改默认密码并配置 <code className="text-slate-400">SESSION_SECRET</code>。
        </p>
        <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
          本地开发请在项目根目录执行 <code className="text-slate-400">npm run dev</code>（同时起前端与后端）；若使用{" "}
          <code className="text-slate-400">vite preview</code>，须先另开终端执行{" "}
          <code className="text-slate-400">npm run start -w server</code>。
        </p>
        <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
          若终端出现 <code className="text-slate-400">EADDRINUSE</code>，说明 API 端口被占用：关掉其它终端里旧的{" "}
          <code className="text-slate-400">node</code> 进程，或设置环境变量{" "}
          <code className="text-slate-400">PORT</code> / <code className="text-slate-400">API_PORT</code> 为空闲端口（须与{" "}
          <code className="text-slate-400">vite.config</code> 代理一致）。
        </p>
      </div>
    </div>
  );
}
