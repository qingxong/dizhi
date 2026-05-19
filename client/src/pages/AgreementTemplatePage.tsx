import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { AgreementPlaceholderDoc } from "../types";

async function saveBlobResponse(res: Response, filename: string) {
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgreementTemplatePage() {
  const [placeholders, setPlaceholders] = useState<AgreementPlaceholderDoc[]>([]);
  const [sample, setSample] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<{ exists: boolean; updated_at: string | null; size: number | null } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    setErr(null);
    Promise.all([api.agreementTemplate.placeholders(), api.agreementTemplate.info()])
      .then(([ph, inf]) => {
        setPlaceholders(ph.placeholders);
        setSample(inf.sample_data);
        setInfo({ exists: inf.exists, updated_at: inf.updated_at, size: inf.size });
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    setErr(null);
    try {
      const r = await api.agreementTemplate.upload(file);
      setInfo(r);
      setMsg("模板已更新");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">地址协议模板</h2>
        <p className="text-slate-400 text-sm mt-1">
          上传 Word（.docx）模板，在正文中使用占位符如 {"{enterprise_name}"}。审核通过后将自动填充并生成 PDF（需服务器安装
          LibreOffice；否则生成 DOCX）。
        </p>
      </div>

      {err && <p className="text-red-400 text-sm">{err}</p>}
      {msg && <p className="text-emerald-400 text-sm">{msg}</p>}

      <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">当前模板</h3>
        {info?.exists ? (
          <p className="text-sm text-slate-400">
            已上传 · 更新于 {info.updated_at ? new Date(info.updated_at).toLocaleString("zh-CN") : "—"}
            {info.size != null ? ` · ${(info.size / 1024).toFixed(1)} KB` : ""}
          </p>
        ) : (
          <p className="text-sm text-amber-400/90">尚未上传模板，协议审核通过后将无法生成文件。</p>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm cursor-pointer">
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                void onUpload(f);
                e.target.value = "";
              }}
            />
            {uploading ? "上传中…" : "上传 / 替换模板"}
          </label>
          {info?.exists && (
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() =>
                void api.agreementTemplate.download().then((res) => saveBlobResponse(res, "agreement-template.docx"))
              }
            >
              下载当前模板
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
          <h3 className="text-sm font-medium text-white">可用占位符</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">在 Word 中写入左列「占位符」形式（含花括号）</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-900/40">
              <tr>
                <th className="px-4 py-2">占位符</th>
                <th className="px-4 py-2">含义</th>
                <th className="px-4 py-2">数据来源</th>
                <th className="px-4 py-2">示例值</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {placeholders.map((p) => (
                <tr key={p.key}>
                  <td className="px-4 py-2 font-mono text-sky-300/90">{`{${p.key}}`}</td>
                  <td className="px-4 py-2 text-slate-300">{p.label}</td>
                  <td className="px-4 py-2 text-slate-500">{p.source}</td>
                  <td className="px-4 py-2 text-slate-400 max-w-xs break-all">{sample[p.key] ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
