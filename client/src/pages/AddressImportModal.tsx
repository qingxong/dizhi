import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { api } from "../api";
import {
  normalizeAddressTypeForClient,
  parseAddressImportFromMatrix,
  parseAddressImportText,
} from "../utils/parseAddressImport.ts";
import { downloadAddressImportTemplateXlsx, readAddressSheetMatrixFromFile } from "../utils/addressImportXlsx.ts";

export default function AddressImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState("");
  const [excelMatrix, setExcelMatrix] = useState<string[][] | null>(null);
  const [excelName, setExcelName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [detailLines, setDetailLines] = useState<string[] | null>(null);

  const parsed = useMemo(() => {
    if (excelMatrix) return parseAddressImportFromMatrix(excelMatrix);
    if (text.trim()) return parseAddressImportText(text);
    return null;
  }, [excelMatrix, text]);

  function clearExcel() {
    setExcelMatrix(null);
    setExcelName(null);
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMsg(null);
    setDetailLines(null);
    const name = f.name.toLowerCase();
    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        setExcelMatrix(await readAddressSheetMatrixFromFile(f));
        setExcelName(f.name);
        setText("");
      } else {
        clearExcel();
        setText(await f.text());
      }
    } catch (err) {
      setMsg((err as Error).message || "无法读取该文件");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setDetailLines(null);
    const p = excelMatrix ? parseAddressImportFromMatrix(excelMatrix) : parseAddressImportText(text);
    if (!p.ok) {
      setMsg(p.message);
      return;
    }
    setBusy(true);
    try {
      await api.addresses.importBatch(p.rows);
      onDone();
    } catch (err) {
      const er = err as Error & { details?: { row: number; message: string }[] };
      setMsg(er.message);
      setDetailLines(er.details?.map((d) => d.message) ?? null);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = parsed?.ok === true;
  const inputCls =
    "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-200";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 z-10 backdrop-blur">
          <div>
            <h3 className="font-semibold text-white">批量导入地址</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              推荐下载 Excel 模板填写后上传；也支持粘贴 TSV/CSV。
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none shrink-0">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {msg && <p className="text-sm text-red-400">{msg}</p>}
          {detailLines && detailLines.length > 0 && (
            <ul className="text-xs text-red-300/90 list-disc pl-4 max-h-40 overflow-y-auto space-y-0.5">
              {detailLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadAddressImportTemplateXlsx}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
            >
              下载模板（Excel）
            </button>
            <label className="text-sm px-3 py-1.5 rounded-lg bg-slate-700 text-white hover:bg-slate-600 cursor-pointer">
              选择文件…
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => void onPickFile(e)}
              />
            </label>
            {excelName && (
              <button
                type="button"
                onClick={() => {
                  clearExcel();
                  setMsg(null);
                  setDetailLines(null);
                }}
                className="text-sm px-3 py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200"
              >
                清除已选 Excel
              </button>
            )}
          </div>
          {excelName && <p className="text-xs text-sky-400/90">已读取「{excelName}」</p>}
          <textarea
            value={text}
            disabled={!!excelMatrix}
            onChange={(e) => {
              setText(e.target.value);
              setMsg(null);
              setDetailLines(null);
            }}
            rows={10}
            placeholder="address_type	address_region	detail_address"
            className={`${inputCls} font-mono disabled:opacity-50`}
            spellCheck={false}
          />
          {parsed?.ok && (
            <p className="text-xs text-slate-400">
              已解析 <span className="text-slate-200 font-medium">{parsed.rows.length}</span> 条
            </p>
          )}
          {parsed && !parsed.ok && (text.trim() || excelMatrix) && (
            <p className="text-xs text-amber-400/90">{parsed.message}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
              取消
            </button>
            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              {busy ? "导入中…" : "开始导入"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
