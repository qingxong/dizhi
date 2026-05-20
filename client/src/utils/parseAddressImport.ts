import type { AddressType } from "../types";
import { ADDRESS_TYPE_LABELS } from "../types";

/** 解析单行 CSV（支持双引号包裹、逗号分隔；`""` 表示字面 `"`） */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === "," || c === "\t") && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function splitDataRow(line: string, delimiter: "\t" | ","): string[] {
  if (delimiter === "\t") return line.split("\t").map((s) => s.trim());
  return parseCsvLine(line);
}

type ColKey = "address_type" | "address_region" | "detail_address";

function headerToKey(cell: string): ColKey | null {
  const h = cell.trim();
  const low = h.toLowerCase();
  if (low === "address_type" || h === "地址类型") return "address_type";
  if (low === "address_region" || h === "地址区域") return "address_region";
  if (low === "detail_address" || h === "详细地址") return "detail_address";
  return null;
}

export type ParsedAddressRow = {
  address_type: string;
  address_region: string;
  detail_address: string;
};

export type ParseAddressImportResult =
  | { ok: true; rows: ParsedAddressRow[] }
  | { ok: false; message: string };

/** 去掉 UTF-8 BOM */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseAddressImportFromMatrix(matrix: unknown[][]): ParseAddressImportResult {
  const rows: string[][] = matrix
    .map((row) =>
      (Array.isArray(row) ? row : []).map((c) => (c == null || c === undefined ? "" : String(c).trim())),
    )
    .filter((row) => row.some((cell) => cell !== ""));
  if (rows.length < 2) {
    return { ok: false, message: "至少需要一行表头与一行数据" };
  }
  const headerCells = rows[0]!;
  const idx: Partial<Record<ColKey, number>> = {};
  headerCells.forEach((cell, i) => {
    const k = headerToKey(cell);
    if (k != null && idx[k] === undefined) idx[k] = i;
  });
  if (idx.address_type === undefined || idx.address_region === undefined || idx.detail_address === undefined) {
    return {
      ok: false,
      message:
        "表头须包含列：address_type（或「地址类型」）、address_region（或「地址区域」）、detail_address（或「详细地址」）",
    };
  }

  const out: ParsedAddressRow[] = [];
  for (let li = 1; li < rows.length; li++) {
    const cells = rows[li]!;
    const iType = idx.address_type!;
    const iReg = idx.address_region!;
    const iDet = idx.detail_address!;
    const address_type = (cells[iType] ?? "").trim();
    const address_region = (cells[iReg] ?? "").trim();
    const detail_address = (cells[iDet] ?? "").trim();
    if (!address_type && !address_region && !detail_address) continue;
    out.push({ address_type, address_region, detail_address });
  }
  if (out.length === 0) {
    return { ok: false, message: "未解析到任何数据行（空行已跳过）" };
  }
  if (out.length > 500) {
    return { ok: false, message: "单次最多导入 500 条，请拆分文件" };
  }
  return { ok: true, rows: out };
}

/**
 * 从 UTF-8 文本解析地址表：首行为表头（须含 地址类型/address_type、地址区域、详细地址 列名），
 * 分隔符优先制表符（与 Excel「文本文件(制表符分隔)」一致），否则按逗号 CSV。
 */
export function parseAddressImportText(text: string): ParseAddressImportResult {
  const raw = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    return { ok: false, message: "至少需要一行表头与一行数据" };
  }
  const first = lines[0]!;
  const delimiter: "\t" | "," = first.includes("\t") ? "\t" : ",";
  const matrix = lines.map((line) => splitDataRow(line, delimiter));
  return parseAddressImportFromMatrix(matrix);
}

const CN_TO_EN: Record<string, AddressType> = {
  [ADDRESS_TYPE_LABELS.coworking]: "coworking",
  [ADDRESS_TYPE_LABELS.business_secretary]: "business_secretary",
  /** 历史表头「地址挂靠」按集中办公区导入 */
  地址挂靠: "coworking",
};

export function isValidAddressTypeCode(s: string): s is AddressType {
  return s === "coworking" || s === "business_secretary";
}

export function normalizeAddressTypeForClient(raw: string): AddressType | null {
  const t = raw.trim();
  if (isValidAddressTypeCode(t)) return t;
  return CN_TO_EN[t] ?? null;
}
