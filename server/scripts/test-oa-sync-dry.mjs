/**
 * 模拟同步统计：指定销售负责人，统计可入库条数（子表单或历史主表电话）
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const BASE = process.env.OA_API_BASE_URL || "https://wx.hnzhcyy.cn";
const APP = process.env.OA_APP_ID || "50cf5a8c1217c1b137c55032";
const ENTRY = process.env.OA_CUSTOMER_ENTRY_ID || "56ac09c06e2dd06a08f7ed6c";
const KEY = process.env.OA_API_KEY?.trim();

const F = {
  sub: "_widget_1770291560898",
  method: "_widget_1770291561102",
  type: "_widget_1770291560978",
  name: "_widget_1770291560923",
  legacyPhone: "_widget_1697441011506",
  legacyType: "_widget_1697441011488",
  legacyName: "_widget_1745573690580",
  owner: "_widget_1697441012855",
  ctype: "_widget_1697441011400",
};

const ownerId = process.argv[2] || "5510d8bca7954f77a387b0a1";

function hasPhone(row) {
  const sub = row[F.sub];
  if (Array.isArray(sub) && sub[0]) {
    const m = sub[0][F.method];
    if (m && String(m).match(/\d{7,}/) && !String(m).includes("备注")) return "subform";
  }
  const leg = row[F.legacyPhone];
  if (leg && String(leg).match(/\d{7,}/)) return "legacy";
  return null;
}

function okType(t) {
  return t === "直客" || t === "渠道";
}

async function fetchPage(skip) {
  const res = await fetch(`${BASE}/openapi/v1/app/${APP}/entry/${ENTRY}/data`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      limit: 300,
      skip,
      filter: { rel: "and", cond: [{ field: F.owner, method: "eq", value: [ownerId] }] },
      fields: Object.values(F).filter((x) => x !== F.owner),
    }),
  });
  const json = JSON.parse(await res.text());
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 200));
  return json.data || [];
}

let total = 0;
let importable = 0;
const bySource = { subform: 0, legacy: 0 };
let badType = 0;
let noPhone = 0;

for (let skip = 0; skip < 1200; skip += 300) {
  const page = await fetchPage(skip);
  if (!page.length) break;
  for (const row of page) {
    total++;
    const src = hasPhone(row);
    if (!src) {
      noPhone++;
      continue;
    }
    if (!okType(row[F.ctype])) {
      badType++;
      continue;
    }
    importable++;
    bySource[src]++;
  }
  if (page.length < 300) break;
  await new Promise((r) => setTimeout(r, 600));
}

console.log(JSON.stringify({ ownerId, total, importable, bySource, noPhone, badType }, null, 2));
