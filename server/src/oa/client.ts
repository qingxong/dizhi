import { OA } from "./constants.js";

export type OaListResponse = {
  data?: Record<string, unknown>[];
};

type OaErrorBody = {
  code?: number;
  message?: string;
  msg?: string;
};

/** OA 接口业务错误（含 4004 限流） */
export class OaApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "OaApiError";
  }

  get isRateLimited(): boolean {
    return this.code === 4004;
  }
}

const PAGE_DELAY_MS = Number(process.env.OA_PAGE_DELAY_MS) || 600;
const RATE_LIMIT_RETRY_DELAY_MS = Number(process.env.OA_RATE_LIMIT_RETRY_MS) || 2500;
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function apiKey(): string {
  const key = process.env.OA_API_KEY?.trim();
  if (!key) throw new Error("未配置 OA_API_KEY，请在服务器环境变量中设置");
  return key;
}

function dataUrl(): string {
  return `${OA.BASE_URL}/openapi/v1/app/${OA.APP_ID}/entry/${OA.ENTRY_ID}/data`;
}

function oaErrorMessage(json: OaErrorBody, fallback: string): string {
  const raw = json.message ?? json.msg;
  if (raw && typeof raw === "string") return raw;
  if (json.code === 4004) return "超出请求频率限制，请稍后再试";
  return fallback;
}

async function fetchOaCustomerPageOnce(opts: {
  limit: number;
  skip: number;
  salesOwnerId?: string | null;
}): Promise<Record<string, unknown>[]> {
  const body: Record<string, unknown> = {
    limit: opts.limit,
    skip: opts.skip,
    fields: OA.QUERY_FIELDS,
  };

  if (opts.salesOwnerId) {
    body.filter = {
      rel: "and",
      cond: [
        {
          field: OA.FIELDS.salesOwner,
          method: "eq",
          value: [opts.salesOwnerId],
        },
      ],
    };
  }

  const res = await fetch(dataUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: OaListResponse & OaErrorBody;
  try {
    json = JSON.parse(text) as OaListResponse & OaErrorBody;
  } catch {
    throw new OaApiError(`OA 接口返回非 JSON（HTTP ${res.status}）`, undefined, res.status);
  }

  if (!res.ok) {
    const msg = oaErrorMessage(json, text.slice(0, 200) || res.statusText);
    throw new OaApiError(`OA 查询失败：${msg}`, json.code, res.status);
  }

  return Array.isArray(json.data) ? json.data : [];
}

/** 单次分页请求；遇 4004 限流时等待后重试 */
async function fetchOaCustomerPage(opts: {
  limit: number;
  skip: number;
  salesOwnerId?: string | null;
}): Promise<Record<string, unknown>[]> {
  let lastErr: OaApiError | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
      }
      return await fetchOaCustomerPageOnce(opts);
    } catch (e) {
      if (e instanceof OaApiError && e.isRateLimited) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw (
    lastErr ??
    new OaApiError("OA 查询失败：超出请求频率限制，请等待约 1 分钟后再同步", 4004)
  );
}

/** 分页拉取全部（页间延迟 + 限流重试） */
export async function fetchAllOaCustomers(salesOwnerId?: string | null): Promise<Record<string, unknown>[]> {
  const limit = 300;
  const all: Record<string, unknown>[] = [];
  let skip = 0;
  for (;;) {
    const page = await fetchOaCustomerPage({ limit, skip, salesOwnerId });
    all.push(...page);
    if (page.length < limit) break;
    skip += limit;
    await sleep(PAGE_DELAY_MS);
  }
  return all;
}
