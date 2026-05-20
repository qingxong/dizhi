import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

const BASE = process.env.OA_API_BASE_URL || "https://wx.hnzhcyy.cn";
const APP = process.env.OA_APP_ID || "50cf5a8c1217c1b137c55032";
const ENTRY = process.env.OA_CUSTOMER_ENTRY_ID || "56ac09c06e2dd06a08f7ed6c";
const KEY = process.env.OA_API_KEY?.trim();
const SUB = "_widget_1770291560898";
const METHOD = "_widget_1770291561102";
const TYPE = "_widget_1770291560978";

async function fetchPage(body) {
  const url = `${BASE}/openapi/v1/app/${APP}/entry/${ENTRY}/data`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = JSON.parse(await res.text());
  if (!res.ok) throw new Error(JSON.stringify(json).slice(0, 300));
  return json.data || [];
}

function hasPhoneInSub(row) {
  const sub = row[SUB];
  if (!Array.isArray(sub) || sub.length === 0) return false;
  const r0 = sub[0];
  if (!r0 || typeof r0 !== "object") return false;
  const method = r0[METHOD];
  return method != null && String(method).trim().match(/\d{7,}/);
}

// scan first 200 records (no fields = full payload)
const batch = await fetchPage({ limit: 200, skip: 0 });
let withSub = 0;
let withPhone = 0;
let sampleWithPhone = null;
for (const row of batch) {
  const sub = row[SUB];
  if (Array.isArray(sub) && sub.length > 0) withSub++;
  if (hasPhoneInSub(row)) {
    withPhone++;
    if (!sampleWithPhone) sampleWithPhone = row;
  }
}
console.log("scan 200 (no fields limit):", { withSubformRows: withSub, withPhoneRow0: withPhone });
if (sampleWithPhone) {
  console.log("sample sn:", sampleWithPhone._widget_1697442470135);
  console.log("subform[0]:", JSON.stringify(sampleWithPhone[SUB][0], null, 2));
  console.log("salesOwner:", JSON.stringify(sampleWithPhone._widget_1697441012855));
}

// with fields array (current prod)
const batch2 = await fetchPage({
  limit: 200,
  skip: 0,
  fields: [
    "_widget_1697441011116",
    SUB,
    "_widget_1697441011400",
    "_widget_1697441012855",
    "_widget_1697442470135",
  ],
});
let withPhone2 = 0;
for (const row of batch2) if (hasPhoneInSub(row)) withPhone2++;
console.log("scan 200 (with fields limit):", { withPhoneRow0: withPhone2 });
