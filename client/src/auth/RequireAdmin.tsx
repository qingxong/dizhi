import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext.tsx";

export default function RequireAdmin() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="text-slate-500 text-sm py-8 text-center animate-pulse">加载中…</div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
