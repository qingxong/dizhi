import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.tsx";

const navAll = [
  { to: "/", label: "总览", end: true },
  { to: "/addresses", label: "地址库", adminOnly: true },
  { to: "/users", label: "用户管理", adminOnly: true },
  { to: "/affiliations", label: "挂靠流程" },
  { to: "/analytics", label: "统计分析" },
] as const;

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = navAll.filter((item) => !("adminOnly" in item && item.adminOnly) || user?.role === "admin");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14 gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              址
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">企业地址管理</h1>
              <p className="text-[11px] text-slate-500 truncate">内部员工 · 主数据与服务流程</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-1 sm:flex-initial justify-end min-w-0">
            <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={"end" in item ? item.end : false}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {user && (
              <div className="flex items-center gap-2 shrink-0 border-l border-slate-800 pl-3">
                <span className="text-xs text-slate-400 hidden sm:inline max-w-[120px] truncate" title={user.displayName}>
                  {user.displayName}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    user.role === "admin" ? "bg-violet-500/20 text-violet-300" : "bg-slate-600/40 text-slate-300"
                  }`}
                >
                  {user.role === "admin" ? "管理员" : "业务员"}
                </span>
                <button
                  type="button"
                  onClick={() => void logout().then(() => navigate("/login", { replace: true }))}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800"
                >
                  退出
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-600">
        仅供企业内部使用 · 请勿外传敏感地址与客户信息
      </footer>
    </div>
  );
}
