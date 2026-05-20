import * as XLSX from "xlsx";

/** 生成并下载「地址导入模板.xlsx」（首行为中文表头，含一行示例） */
export function downloadAddressImportTemplateXlsx(): void {
  const data = [
    ["地址类型", "地址区域", "详细地址"],
    ["coworking", "海南省海口市龙华区", "兴洋大道181号"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 42 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "地址列表");
  XLSX.writeFile(wb, "地址导入模板.xlsx");
}

/** 读取 .xlsx / .xls 第一个工作表为二维数组（字符串单元格） */
export async function readAddressSheetMatrixFromFile(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel 文件中未找到工作表");
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error("无法读取工作表");
  const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  return aoa.map((row) =>
    (Array.isArray(row) ? row : []).map((c) => {
      if (c == null || c === "") return "";
      if (typeof c === "boolean") return c ? "TRUE" : "FALSE";
      return String(c).trim();
    }),
  );
}
