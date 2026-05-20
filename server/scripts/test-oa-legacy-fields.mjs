import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

config({ path: join(dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const BASE = process.env.OA_API_BASE_URL || "https://wx.hnzhcyy.cn";
const APP = process.env.OA_APP_ID || "50cf5a8c1217c1b137c55032";
const ENTRY = process.env.OA_CUSTOMER_ENTRY_ID || "56ac09c06e2dd06a08f7ed6c";
const KEY = process.env.OA_API_KEY?.trim();

const rows = await (async () => {
  const res = await fetch(`${BASE}/openapi/v1/app/${APP}/entry/${ENTRY}/data`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 50, skip: 0 }),
  });
  const json = JSON.parse(await res.text());
  return json.data || [];
})();

const SUB = "_widget_1770291560898";
const LEGACY_PHONE = "_widget_1697441011506";
const LEGACY_NAME = "_widget_1745573690580";

let subPhone = 0;
let legacyPhone = 0;
for (const r of rows) {
  const sub = r[SUB];
  if (Array.isArray(sub) && sub[0]?._widget_1770291561102?.match?.(/\d/)) subPhone++;
  if (r[LEGACY_PHONE] && String(r[LEGACY_PHONE]).match(/\d{7,}/)) legacyPhone++;
}
console.log({ scanned: rows.length, subformPhone: subPhone, legacyFieldPhone: legacyPhone });
const ex = rows.find((r) => r[LEGACY_PHONE] && String(r[LEGACY_PHONE]).match(/\d/));
if (ex) {
  console.log("legacy example:", {
    sn: ex._widget_1697442470135,
    legacyName: ex[LEGACY_NAME],
    legacyPhone: ex[LEGACY_PHONE],
    sub: ex[SUB],
  });
}
