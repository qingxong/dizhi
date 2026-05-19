import type {
  Address,
  AddressChoice,
  AffiliationRequest,
  AgreementPlaceholderDoc,
  AuthUser,
  ManagedUser,
  StatsResponse,
} from "./types";

const cred: RequestInit = { credentials: "include" };

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = res.statusText;
    const ct = res.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) {
        const j = (await res.json()) as { error?: string };
        if (j.error) msg = j.error;
      } else {
        const text = await res.text();
        if (res.status === 404 && text.includes("Cannot POST")) {
          msg =
            "登录接口未找到：请确认后端已成功监听（终端应出现 API listening）。若出现 EADDRINUSE，请关闭占用端口的旧进程后再执行 npm run dev。";
        } else if (text.length && text.length < 200) msg = text;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    me: () => fetch("/api/auth/me", cred).then((r) => parseJson<{ user: AuthUser | null }>(r)),
    login: (username: string, password: string) =>
      fetch("/api/auth/login", {
        ...cred,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }).then((r) => parseJson<{ user: AuthUser }>(r)),
    logout: () =>
      fetch("/api/auth/logout", { ...cred, method: "POST" }).then((r) => {
        if (!r.ok && r.status !== 204) throw new Error(r.statusText);
      }),
  },
  addresses: {
    list: (params?: { address_type?: string; q?: string; occupancy?: "available" | "occupied" }) => {
      const sp = new URLSearchParams();
      if (params?.address_type) sp.set("address_type", params.address_type);
      if (params?.q) sp.set("q", params.q);
      if (params?.occupancy) sp.set("occupancy", params.occupancy);
      const q = sp.toString();
      return fetch(`/api/addresses${q ? `?${q}` : ""}`, cred).then((r) => parseJson<Address[]>(r));
    },
    get: (id: string) => fetch(`/api/addresses/${id}`, cred).then((r) => parseJson<Address>(r)),
    create: (body: Partial<Address> & { address_type: string; address_region: string; detail_address: string }) =>
      fetch("/api/addresses", {
        ...cred,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<Address>(r)),
    update: (id: string, body: Record<string, unknown>) =>
      fetch(`/api/addresses/${id}`, {
        ...cred,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<Address>(r)),
    remove: (id: string) =>
      fetch(`/api/addresses/${id}`, { ...cred, method: "DELETE" }).then((r) => {
        if (!resOk(r)) throw new Error("删除失败");
      }),
    importBatch: (items: { address_type: string; address_region: string; detail_address: string }[]) =>
      fetch("/api/addresses/import", {
        ...cred,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).then(async (r) => {
        if (!r.ok) {
          let msg = r.statusText;
          let details: { row: number; message: string }[] | undefined;
          try {
            const j = (await r.json()) as { error?: string; details?: { row: number; message: string }[] };
            if (j.error) msg = j.error;
            if (Array.isArray(j.details)) details = j.details;
          } catch {
            /* ignore */
          }
          const e = new Error(msg) as Error & { details?: { row: number; message: string }[] };
          if (details) e.details = details;
          throw e;
        }
        return r.json() as Promise<{ inserted: number }>;
      }),
  },
  addressChoices: {
    list: () => fetch("/api/address-choices", cred).then((r) => parseJson<AddressChoice[]>(r)),
  },
  addressRegions: {
    list: (address_type: string) =>
      fetch(`/api/address-regions?address_type=${encodeURIComponent(address_type)}`, cred).then((r) =>
        parseJson<{ regions: string[] }>(r),
      ),
  },
  affiliations: {
    list: () => fetch("/api/affiliations", cred).then((r) => parseJson<AffiliationRequest[]>(r)),
    create: (body: Record<string, unknown>) =>
      fetch("/api/affiliations", {
        ...cred,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<AffiliationRequest>(r)),
    patch: (id: string, body: Record<string, unknown>) =>
      fetch(`/api/affiliations/${id}`, {
        ...cred,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<AffiliationRequest>(r)),
    remove: (id: string) =>
      fetch(`/api/affiliations/${id}`, { ...cred, method: "DELETE" }).then((r) => {
        if (!resOk(r)) throw new Error("删除失败");
      }),
    /** 法人身份证正反面：JPEG / PNG / WebP，单张最大 8MB */
    uploadIdPhoto: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/affiliations/uploads/id-photo", {
        ...cred,
        method: "POST",
        body: fd,
      }).then((r) => parseJson<{ url: string }>(r));
    },
    /** 办理地址变更时的执照：JPEG / PNG / WebP，单张最大 8MB */
    uploadLicensePhoto: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/affiliations/uploads/license-photo", {
        ...cred,
        method: "POST",
        body: fd,
      }).then((r) => parseJson<{ url: string }>(r));
    },
    submitAgreement: (
      id: string,
      body: { enterprise_name: string; amount: string; service_start: string; service_end: string },
    ) =>
      fetch(`/api/affiliations/${id}/agreement/submit`, {
        ...cred,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<AffiliationRequest>(r)),
    reviewAgreement: (id: string, body: { action: "approve" | "reject"; review_comment?: string }) =>
      fetch(`/api/affiliations/${id}/agreement/review`, {
        ...cred,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<AffiliationRequest>(r)),
    uploadSignedAgreement: (id: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch(`/api/affiliations/${id}/agreement/signed`, {
        ...cred,
        method: "POST",
        body: fd,
      }).then((r) => parseJson<AffiliationRequest>(r));
    },
    downloadGeneratedAgreement: (id: string) =>
      fetch(`/api/affiliations/${id}/agreement/generated`, cred),
    downloadSignedAgreement: (id: string) => fetch(`/api/affiliations/${id}/agreement/signed`, cred),
  },
  agreementTemplate: {
    placeholders: () =>
      fetch("/api/agreement-template/placeholders", cred).then((r) =>
        parseJson<{ placeholders: AgreementPlaceholderDoc[]; status_labels: Record<string, string> }>(r),
      ),
    info: () =>
      fetch("/api/agreement-template/info", cred).then((r) =>
        parseJson<{
          exists: boolean;
          updated_at: string | null;
          size: number | null;
          sample_data: Record<string, string>;
        }>(r),
      ),
    upload: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return fetch("/api/agreement-template", { ...cred, method: "POST", body: fd }).then((r) =>
        parseJson<{ exists: boolean; updated_at: string | null; size: number | null }>(r),
      );
    },
    download: () => fetch("/api/agreement-template/download", cred),
  },
  stats: () => fetch("/api/stats", cred).then((r) => parseJson<StatsResponse>(r)),
  users: {
    list: () => fetch("/api/users", cred).then((r) => parseJson<ManagedUser[]>(r)),
    changeMyPassword: (current_password: string, new_password: string) =>
      fetch("/api/users/me/password", {
        ...cred,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password, new_password }),
      }).then((r) => parseJson<{ ok: boolean }>(r)),
    createSales: (body: { username: string; password: string; display_name: string }) =>
      fetch("/api/users", {
        ...cred,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<ManagedUser>(r)),
    update: (id: string, body: { username?: string; display_name?: string; password?: string }) =>
      fetch(`/api/users/${id}`, {
        ...cred,
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parseJson<ManagedUser>(r)),
    remove: (id: string) =>
      fetch(`/api/users/${id}`, { ...cred, method: "DELETE" }).then((r) => {
        if (!resOk(r)) throw new Error("删除失败");
      }),
  },
};

function resOk(r: Response) {
  return r.ok || r.status === 204;
}
