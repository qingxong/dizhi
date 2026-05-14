import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/AuthContext.tsx";
import { api } from "../api";
import type { ManagedUser } from "../types";

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function inputCls() {
  return "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40";
}

export default function UsersPage() {
  const { user } = useAuth();
  const [list, setList] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [editRow, setEditRow] = useState<ManagedUser | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.users
      .list()
      .then((data) => {
        setList(data);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setOkMsg(null);
    setError(null);
    if (newPwd.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (newPwd !== newPwd2) {
      setError("两次输入的新密码不一致");
      return;
    }
    setPwdBusy(true);
    try {
      await api.users.changeMyPassword(curPwd, newPwd);
      setCurPwd("");
      setNewPwd("");
      setNewPwd2("");
      setOkMsg("管理员密码已更新，请牢记新密码。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPwdBusy(false);
    }
  }

  const salesUsers = list.filter((u) => u.role === "sales");
  const adminUsers = list.filter((u) => u.role === "admin");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">用户管理</h2>
        <p className="text-slate-400 text-sm mt-1">
          仅管理员可访问：修改当前登录管理员密码，以及新增、编辑、删除业务员账号。
        </p>
      </div>

      {(error || okMsg) && (
        <div className="space-y-1">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {okMsg && <p className="text-emerald-400 text-sm">{okMsg}</p>}
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-900/25 p-5 space-y-4">
        <h3 className="text-sm font-medium text-white">管理员密码</h3>
        <p className="text-xs text-slate-500">
          当前登录：<span className="text-slate-300">{user?.username}</span>（{user?.displayName}）
        </p>
        <form onSubmit={(e) => void submitPassword(e)} className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          <div>
            <label className="block text-xs text-slate-500 mb-1">当前密码 *</label>
            <input
              type="password"
              autoComplete="current-password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              className={inputCls()}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">新密码 *（至少 6 位）</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className={inputCls()}
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">确认新密码 *</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPwd2}
              onChange={(e) => setNewPwd2(e.target.value)}
              className={inputCls()}
              required
              minLength={6}
            />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={pwdBusy}
              className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {pwdBusy ? "保存中…" : "更新管理员密码"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/25 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-white">业务员账号</h3>
            <p className="text-xs text-slate-500 mt-0.5">可修改登录名、显示名称与登录密码；删除后该用户无法再登录。</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOkMsg(null);
              setShowNew(true);
            }}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 shrink-0"
          >
            新建业务员
          </button>
        </div>

        {adminUsers.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-800/80 text-xs text-slate-500">
            系统内管理员账号共 {adminUsers.length} 个（不在此表内编辑，请使用上方「管理员密码」修改当前账号密码）。
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[640px]">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">用户名</th>
                <th className="px-4 py-3 font-medium">显示名称</th>
                <th className="px-4 py-3 font-medium">创建日期</th>
                <th className="px-4 py-3 font-medium w-40">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    加载中…
                  </td>
                </tr>
              ) : salesUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    暂无业务员，请点击「新建业务员」。
                  </td>
                </tr>
              ) : (
                salesUsers.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">{r.username}</td>
                    <td className="px-4 py-3 text-slate-300">{r.display_name}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatTime(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                          onClick={() => {
                            setError(null);
                            setOkMsg(null);
                            setEditRow(r);
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-red-900/40 hover:bg-red-800/50 text-red-200"
                          onClick={async () => {
                            if (!confirm(`确定删除业务员「${r.username}」？其将无法再登录。`)) return;
                            try {
                              await api.users.remove(r.id);
                              setOkMsg(`已删除用户 ${r.username}`);
                              load();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
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
      </section>

      {showNew && (
        <NewSalesModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            setOkMsg("业务员已创建");
            load();
          }}
          onError={(m) => {
            setOkMsg(null);
            setError(m);
          }}
        />
      )}
      {editRow && (
        <EditSalesModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            setOkMsg("已保存修改");
            load();
          }}
          onError={(m) => {
            setOkMsg(null);
            setError(m);
          }}
        />
      )}
    </div>
  );
}

function NewSalesModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [display_name, setDisplay_name] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      await api.users.createSales({
        username: username.trim(),
        display_name: display_name.trim(),
        password,
      });
      onCreated();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-white">新建业务员</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="p-5 space-y-3">
          <label className="block text-xs text-slate-500">登录用户名 *（2–32 位字母、数字、下划线）</label>
          <input
            required
            pattern="[a-zA-Z0-9_]{2,32}"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls()}
            autoComplete="off"
          />
          <label className="block text-xs text-slate-500">显示名称 *</label>
          <input required value={display_name} onChange={(e) => setDisplay_name(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">初始密码 *（至少 6 位）</label>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls()}
            autoComplete="new-password"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              {busy ? "创建中…" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditSalesModal({
  row,
  onClose,
  onSaved,
  onError,
}: {
  row: ManagedUser;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [username, setUsername] = useState(row.username);
  const [display_name, setDisplay_name] = useState(row.display_name);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      const body: { username: string; display_name: string; password?: string } = {
        username: username.trim(),
        display_name: display_name.trim(),
      };
      if (password.trim()) body.password = password;
      await api.users.update(row.id, body);
      onSaved();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-semibold text-white">编辑业务员</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)} className="p-5 space-y-3">
          <label className="block text-xs text-slate-500">登录用户名 *</label>
          <input
            required
            pattern="[a-zA-Z0-9_]{2,32}"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls()}
          />
          <label className="block text-xs text-slate-500">显示名称 *</label>
          <input required value={display_name} onChange={(e) => setDisplay_name(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">新登录密码（留空则不修改）</label>
          <input
            type="password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls()}
            placeholder="至少 6 位"
            autoComplete="new-password"
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
