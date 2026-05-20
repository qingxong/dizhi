import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const BASE = process.env.OA_API_BASE_URL || "https://wx.hnzhcyy.cn";
const APP = process.env.OA_APP_ID || "50cf5a8c1217c1b137c55032";
const ENTRY = process.env.OA_CUSTOMER_ENTRY_ID || "56ac09c06e2dd06a08f7ed6c";
const KEY = process.env.OA_API_KEY?.trim();
const SUB = "_widget_1770291560898";
const METHOD = "_widget_1770291561102";
const OWNER = "_widget_1697441012855";

const ownerId = process.argv[2] || "5510d8bca7954f77a387b0a1"; // 卢裕丹 sample

async function fetchPage(body) {
  const res = await fetch(`${BASE}/openapi/v1/app/${APP}/entry/${ENTRY}/data`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = JSON.parse(await res.text());
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 300));
  return json.data || [];
}

const rows = await fetchPage({
  limit: 300,
  skip: 0,
  filter: { rel: "and", cond: [{ field: OWNER, method: "eq", value: [ownerId] }] },
  fields: ["_widget_1697442470135", SUB, "_widget_1697441011400", OWNER],
});

let phone = 0;
let emptySub = 0;
for (const r of rows) {
  const sub = r[SUB];
  if (!Array.isArray(sub) || !sub.length) emptySub++;
  else if (sub[0]?.[METHOD] && String(sub[0][METHOD]).match(/\d{7,}/)) phone++;
}
console.log({ ownerId, total: rows.length, emptySub, withPhone: phone });
