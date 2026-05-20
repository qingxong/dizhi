import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useAuth } from "../auth/AuthContext.tsx";
import { api } from "../api";
import type { AffiliationContactType, AffiliationRequest, AddressType } from "../types";
import { ADDRESS_TYPE_LABELS, AGREEMENT_STATUS_LABELS, addressTypeLabel } from "../types";
import { validateMaterialFormFormats } from "../utils/contactFormat";
import { CustomerPicker } from "../components/CustomerPicker.tsx";
import { AffiliationAgreementActions } from "./AffiliationAgreementActions.tsx";

const statusStyle: Record<string, string> = {
  draft: "bg-slate-600/30 text-slate-300",
  pending: "bg-amber-500/20 text-amber-300",
  approved: "bg-emerald-500/20 text-emerald-300",
  rejected: "bg-red-500/20 text-red-300",
};

const statusText: Record<string, string> = {
  draft: "草稿",
  pending: "待审批",
  approved: "已通过",
  rejected: "已驳回",
};

const contactLabel: Record<AffiliationContactType, string> = {
  channel: "渠道",
  direct: "直客",
};

type AffiliationStatusFilter = "all" | "draft" | "pending" | "approved" | "rejected";

type MaterialFormState = {
  contact_type: AffiliationContactType;
  need_address_change: boolean;
  channel_company_name: string;
  channel_common_contact_name: string;
  channel_common_contact_phone: string;
  channel_backup_contact_name: string;
  channel_backup_contact_phone: string;
  legal_id_front: string;
  legal_id_back: string;
  legal_name: string;
  legal_id_number: string;
  legal_phone: string;
  legal_contact_address: string;
  legal_email: string;
  enterprise_backup_name: string;
  enterprise_backup_phone: string;
  license_photo: string;
};

function emptyMaterial(): MaterialFormState {
  return {
    contact_type: "direct",
    need_address_change: false,
    channel_company_name: "",
    channel_common_contact_name: "",
    channel_common_contact_phone: "",
    channel_backup_contact_name: "",
    channel_backup_contact_phone: "",
    legal_id_front: "",
    legal_id_back: "",
    legal_name: "",
    legal_id_number: "",
    legal_phone: "",
    legal_contact_address: "",
    legal_email: "",
    enterprise_backup_name: "",
    enterprise_backup_phone: "",
    license_photo: "",
  };
}

function rowToMaterial(r: AffiliationRequest): MaterialFormState {
  const ct: AffiliationContactType = r.contact_type === "channel" ? "channel" : "direct";
  return {
    contact_type: ct,
    need_address_change: !!(r.need_address_change ?? 0),
    channel_company_name: r.channel_company_name ?? "",
    channel_common_contact_name: r.channel_common_contact_name ?? "",
    channel_common_contact_phone: r.channel_common_contact_phone ?? "",
    channel_backup_contact_name: r.channel_backup_contact_name ?? "",
    channel_backup_contact_phone: r.channel_backup_contact_phone ?? "",
    legal_id_front: r.legal_id_front ?? "",
    legal_id_back: r.legal_id_back ?? "",
    legal_name: r.legal_name ?? "",
    legal_id_number: r.legal_id_number ?? "",
    legal_phone: r.legal_phone ?? "",
    legal_contact_address: r.legal_contact_address ?? "",
    legal_email: r.legal_email ?? "",
    enterprise_backup_name: r.enterprise_backup_name ?? "",
    enterprise_backup_phone: r.enterprise_backup_phone ?? "",
    license_photo: r.license_photo ?? "",
  };
}

function materialToApiBody(m: MaterialFormState): Record<string, unknown> {
  return {
    contact_type: m.contact_type,
    need_address_change: m.need_address_change,
    channel_company_name: m.channel_company_name.trim() || null,
    channel_common_contact_name: m.channel_common_contact_name.trim() || null,
    channel_common_contact_phone: m.channel_common_contact_phone.trim() || null,
    channel_backup_contact_name: m.channel_backup_contact_name.trim() || null,
    channel_backup_contact_phone: m.channel_backup_contact_phone.trim() || null,
    legal_id_front: m.legal_id_front.trim() || null,
    legal_id_back: m.legal_id_back.trim() || null,
    legal_name: m.legal_name.trim() || null,
    legal_id_number: m.legal_id_number.trim().toUpperCase() || null,
    legal_phone: m.legal_phone.trim() || null,
    legal_contact_address: m.legal_contact_address.trim() || null,
    legal_email: m.legal_email.trim() || null,
    enterprise_backup_name: m.enterprise_backup_name.trim() || null,
    enterprise_backup_phone: m.enterprise_backup_phone.trim() || null,
    license_photo: m.license_photo.trim() || null,
  };
}

function inputCls() {
  return "w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-600";
}

/** 挂靠表单：提交按钮上方的校验/错误提示 */
function FormSubmitAlert({ message }: { message: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [message]);
  if (!message) return null;
  return (
    <div
      ref={ref}
      role="alert"
      className="rounded-lg border border-red-500/50 bg-red-950/50 px-3 py-2.5 text-sm text-red-200"
    >
      {message}
    </div>
  );
}

/** 列表「地址需求」：完整展示详细地址，支持一键复制 */
function AffiliationListAddressCell({
  addressType,
  addressRegion,
  detailAddress,
}: {
  addressType: AddressType;
  addressRegion: string;
  detailAddress: string | null;
}) {
  const pending = !detailAddress?.trim();
  const [copied, setCopied] = useState<"none" | "detail" | "full">("none");

  const fullText = pending
    ? `${ADDRESS_TYPE_LABELS[addressType]}\n${addressRegion}\n（详细地址待分配）`
    : `${ADDRESS_TYPE_LABELS[addressType]}\n${addressRegion}\n${detailAddress}`;

  async function copy(which: "detail" | "full") {
    const text = which === "full" ? fullText : (detailAddress ?? "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied("none"), 2000);
    } catch {
      /* clipboard 不可用时忽略 */
    }
  }

  return (
    <div className="max-w-md min-w-[220px]">
      <div className="text-xs text-violet-300/90 font-medium">{ADDRESS_TYPE_LABELS[addressType]}</div>
      <div className="text-white font-medium mt-0.5">{addressRegion}</div>
      <div className="mt-1.5 rounded-md border border-slate-700/80 bg-slate-900/60 px-2.5 py-2 max-h-24 overflow-y-auto">
        {pending ? (
          <span className="text-xs text-amber-400/90">详细地址待分配</span>
        ) : (
          <p className="text-xs text-slate-300 break-all leading-relaxed whitespace-pre-wrap select-text">
            {detailAddress}
          </p>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {!pending && (
          <button
            type="button"
            className="text-[11px] text-sky-400 hover:text-sky-300"
            onClick={() => void copy("detail")}
          >
            {copied === "detail" ? "已复制" : "复制详细地址"}
          </button>
        )}
        <button
          type="button"
          className="text-[11px] text-slate-500 hover:text-slate-300"
          onClick={() => void copy("full")}
        >
          {copied === "full" ? "已复制" : "复制全部信息"}
        </button>
      </div>
    </div>
  );
}

/** 业务员申请：选择地址类型与区域（详细地址审批通过后自动分配） */
function AffiliationAddressPreferenceFields({
  addressType,
  addressRegion,
  onAddressTypeChange,
  onAddressRegionChange,
}: {
  addressType: AddressType;
  addressRegion: string;
  onAddressTypeChange: (t: AddressType) => void;
  onAddressRegionChange: (r: string) => void;
}) {
  const [regions, setRegions] = useState<string[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingRegions(true);
    api.addressRegions
      .list(addressType)
      .then((res) => {
        if (!cancelled) setRegions(res.regions);
      })
      .catch(() => {
        if (!cancelled) setRegions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRegions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addressType]);

  return (
    <>
      <label className="block text-xs text-slate-500">地址类型 *</label>
      <select
        required
        value={addressType}
        onChange={(e) => {
          onAddressTypeChange(e.target.value as AddressType);
          onAddressRegionChange("");
        }}
        className={inputCls()}
      >
        <option value="coworking">{ADDRESS_TYPE_LABELS.coworking}</option>
        <option value="business_secretary">{ADDRESS_TYPE_LABELS.business_secretary}</option>
      </select>
      <label className="block text-xs text-slate-500">地址区域 *</label>
      <select
        required
        value={addressRegion}
        disabled={loadingRegions || regions.length === 0}
        onChange={(e) => onAddressRegionChange(e.target.value)}
        className={inputCls()}
      >
        <option value="">{loadingRegions ? "加载区域…" : "请选择区域"}</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {!loadingRegions && regions.length === 0 && (
        <p className="text-[11px] text-amber-400/90">该类型下暂无可用区域，请联系管理员在地址库中维护。</p>
      )}
      <p className="text-[11px] text-slate-500">详细地址将在审批通过后由系统自动分配，无需手动选择。</p>
    </>
  );
}

/** 挂靠材料图片上传（身份证 / 执照），库中存 `/api/uploads/...` 路径 */
function IdPhotoInput({
  label,
  value,
  onChangeUrl,
  uploadFile = api.affiliations.uploadIdPhoto,
}: {
  label: string;
  value: string;
  onChangeUrl: (url: string) => void;
  uploadFile?: (file: File) => Promise<{ url: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const isUploadPath = value.startsWith("/api/uploads/");
  const isLegacyHttp = /^https?:\/\//i.test(value);
  const showPreview = value && (isUploadPath || isLegacyHttp);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setLocalErr(null);
    try {
      const { url } = await uploadFile(file);
      onChangeUrl(url);
    } catch (err) {
      setLocalErr((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="block text-[11px] text-slate-500">{label}</label>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={(e) => void onPick(e)}
        className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white file:text-xs"
      />
      {busy && <p className="text-[11px] text-slate-500">上传中…</p>}
      {localErr && <p className="text-[11px] text-red-400">{localErr}</p>}
      {value && !isUploadPath && !isLegacyHttp && (
        <p className="text-[11px] text-amber-400/90">
          当前为历史文本记录，请重新选择图片文件上传以替换。
        </p>
      )}
      {showPreview && (
        <div className="flex flex-wrap items-start gap-2 pt-1">
          <img
            src={value}
            alt=""
            className="max-h-36 rounded border border-slate-700 object-contain bg-black/20"
          />
          {!busy && (
            <button
              type="button"
              className="text-[11px] text-amber-400 hover:text-amber-300 shrink-0"
              onClick={() => onChangeUrl("")}
            >
              清除并重新上传
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MaterialFormBody({
  value,
  onChange,
}: {
  value: MaterialFormState;
  onChange: (patch: Partial<MaterialFormState>) => void;
}) {
  const isChannel = value.contact_type === "channel";
  return (
    <div className="space-y-4 border-t border-slate-800 pt-4 mt-1">
      <h4 className="text-sm font-medium text-white">地址领取 · 联络人与材料</h4>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        法人身份证正反面均须上传图片文件（JPEG / PNG / WebP，单张不超过 8MB）。若选择「用于办理地址变更」，还须上传执照照片。
      </p>
      <div>
        <label className="block text-xs text-slate-500 mb-1">联络人类型 *</label>
        <div className="flex gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contact_type"
              checked={value.contact_type === "channel"}
              onChange={() => onChange({ contact_type: "channel" })}
            />
            渠道
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="contact_type"
              checked={value.contact_type === "direct"}
              onChange={() => onChange({ contact_type: "direct" })}
            />
            直客
          </label>
        </div>
      </div>
      <CustomerPicker contactType={value.contact_type} onApply={(patch) => onChange(patch)} />
      {isChannel && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
          <div className="text-xs font-medium text-violet-300/90">渠道材料</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-slate-500 mb-1">渠道公司名</label>
              <input
                className={inputCls()}
                value={value.channel_company_name}
                onChange={(e) => onChange({ channel_company_name: e.target.value })}
                placeholder="个人渠道可以直接填写名字"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">常用联系人姓名 *</label>
              <input
                className={inputCls()}
                value={value.channel_common_contact_name}
                onChange={(e) => onChange({ channel_common_contact_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">常用联系人电话 *</label>
              <input
                className={inputCls()}
                value={value.channel_common_contact_phone}
                onChange={(e) => onChange({ channel_common_contact_phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">备用联系人姓名 *</label>
              <input
                className={inputCls()}
                value={value.channel_backup_contact_name}
                onChange={(e) => onChange({ channel_backup_contact_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">备用联系人电话 *</label>
              <input
                className={inputCls()}
                value={value.channel_backup_contact_phone}
                onChange={(e) => onChange({ channel_backup_contact_phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
        <div className="text-xs font-medium text-sky-300/90">企业法人及企业备用联系人</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <IdPhotoInput
            label="法人身份证正面 *"
            value={value.legal_id_front}
            onChangeUrl={(url) => onChange({ legal_id_front: url })}
          />
          <IdPhotoInput
            label="法人身份证反面 *"
            value={value.legal_id_back}
            onChangeUrl={(url) => onChange({ legal_id_back: url })}
          />
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">法人姓名 *</label>
            <input className={inputCls()} value={value.legal_name} onChange={(e) => onChange({ legal_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">法人身份证号 *</label>
            <input
              className={inputCls()}
              value={value.legal_id_number}
              onChange={(e) => onChange({ legal_id_number: e.target.value.toUpperCase() })}
              placeholder="18位身份证号码"
              maxLength={18}
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">法人手机号 *</label>
            <input
              className={inputCls()}
              value={value.legal_phone}
              onChange={(e) => onChange({ legal_phone: e.target.value })}
              placeholder="11位手机号"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">法人联系地址 *</label>
            <input
              className={inputCls()}
              value={value.legal_contact_address}
              onChange={(e) => onChange({ legal_contact_address: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-slate-500 mb-1">法人邮箱 *</label>
            <input
              className={inputCls()}
              type="email"
              value={value.legal_email}
              onChange={(e) => onChange({ legal_email: e.target.value })}
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">企业备用联系人姓名 *</label>
            <input
              className={inputCls()}
              value={value.enterprise_backup_name}
              onChange={(e) => onChange({ enterprise_backup_name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">企业备用联系人电话 *</label>
            <input
              className={inputCls()}
              value={value.enterprise_backup_phone}
              onChange={(e) => onChange({ enterprise_backup_phone: e.target.value })}
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 space-y-3">
        <div>
          <span className="block text-xs text-slate-500 mb-1">是否用于办理地址变更 *</span>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="need_address_change"
                required
                checked={value.need_address_change === true}
                onChange={() => onChange({ need_address_change: true })}
              />
              是
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="need_address_change"
                checked={value.need_address_change === false}
                onChange={() =>
                  onChange({
                    need_address_change: false,
                    license_photo: "",
                  })
                }
              />
              否
            </label>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">选「是」时须上传执照照片。</p>
        </div>
        {value.need_address_change && (
          <IdPhotoInput
            label="执照照片 *"
            value={value.license_photo}
            onChangeUrl={(url) => onChange({ license_photo: url })}
            uploadFile={api.affiliations.uploadLicensePhoto}
          />
        )}
      </div>
    </div>
  );
}

export default function AffiliationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState<AffiliationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editRow, setEditRow] = useState<AffiliationRequest | null>(null);
  const [viewRow, setViewRow] = useState<AffiliationRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AffiliationRequest | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AffiliationStatusFilter>("all");

  const filteredRows = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const ct: AffiliationContactType = r.contact_type === "channel" ? "channel" : "direct";
      const blob = [
        r.applicant_name,
        r.legal_name,
        r.legal_phone,
        r.channel_company_name,
        r.group_name,
        r.agreement_enterprise_name,
        r.agreement_amount,
        AGREEMENT_STATUS_LABELS[
          (r.agreement_status === "pending" ||
          r.agreement_status === "pdf_ready" ||
          r.agreement_status === "completed" ||
          r.agreement_status === "rejected"
            ? r.agreement_status
            : "none") as keyof typeof AGREEMENT_STATUS_LABELS
        ],
        r.requested_address_region,
        r.address_region,
        r.detail_address,
        r.notes,
        r.reviewer_name,
        r.review_comment,
        contactLabel[ct],
        statusText[r.status] ?? r.status,
        addressTypeLabel(r.address_type),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, statusFilter, searchQuery]);

  const load = useCallback(() => {
    setLoading(true);
    api.affiliations
      .list()
      .then((a) => {
        setRows(a);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">地址挂靠流程</h2>
          <p className="text-slate-400 text-sm mt-1">
            申请时选择地址类型与区域，详细地址在审批通过后自动分配；地址通过后可再申请协议（企业名称、金额、服务期），管理员审核后生成 PDF，业务员回传盖章件即完结。
            {isAdmin ? (
              <span className="text-slate-500"> 管理员可审批，也可在待审批/已通过等状态下修改资料。</span>
            ) : (
              <span className="text-slate-500"> 审批通过/驳回仅管理员可操作。</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2"
        >
          新建申请
        </button>
      </div>

      {err && <p className="text-red-400 text-sm">{err}</p>}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3">
        <div className="flex-1 min-w-[200px] max-w-md">
          <label htmlFor="affiliation-search" className="block text-xs text-slate-500 mb-1">
            查询
          </label>
          <input
            id="affiliation-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="企业名称、法人、电话、群名称、地址、申请人…"
            className={inputCls()}
            autoComplete="off"
          />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[180px]">
          <label htmlFor="affiliation-status-filter" className="block text-xs text-slate-500 mb-1">
            状态筛选
          </label>
          <select
            id="affiliation-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AffiliationStatusFilter)}
            className={inputCls()}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="pending">待审批</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/20">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1080px]">
            <thead className="bg-slate-900/80 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">地址需求</th>
                <th className="px-4 py-3 font-medium min-w-[150px]">企业 / 联络</th>
                <th className="px-4 py-3 font-medium">类型</th>
                <th className="px-4 py-3 font-medium">挂靠状态</th>
                <th className="px-4 py-3 font-medium min-w-[120px]">地址协议</th>
                <th className="px-4 py-3 font-medium">时间线</th>
                <th className="px-4 py-3 font-medium w-64">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    加载中…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    暂无申请
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    无匹配结果，可调整关键词或状态筛选
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 align-top">
                      <AffiliationListAddressCell
                        addressType={r.address_type}
                        addressRegion={r.address_region}
                        detailAddress={r.detail_address}
                      />
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <div
                        className="text-white font-medium break-all"
                        title={r.agreement_enterprise_name ?? undefined}
                      >
                        {r.agreement_enterprise_name?.trim() || "—"}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">企业名称</div>
                      <div className="text-slate-300 font-medium mt-2">{r.legal_name?.trim() || "—"}</div>
                      <div className="text-slate-400 mt-0.5 tabular-nums">{r.legal_phone?.trim() || "—"}</div>
                      <div className="text-slate-500 mt-1 break-all" title={r.group_name ?? undefined}>
                        群：{r.group_name?.trim() || "—"}
                      </div>
                      <div className="text-slate-600 mt-1.5 pt-1 border-t border-slate-800/80">
                        申请 {r.applicant_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 align-top">
                      <span className="text-slate-300">{contactLabel[r.contact_type === "channel" ? "channel" : "direct"]}</span>
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
                          onClick={() => setViewRow(r)}
                        >
                          查看材料
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[r.status]}`}>
                        {statusText[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AffiliationAgreementActions row={r} isAdmin={isAdmin} onReload={load} onError={setErr} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 space-y-0.5 align-top">
                      <div>创建 {formatTime(r.created_at)}</div>
                      {r.submitted_at && <div>提交 {formatTime(r.submitted_at)}</div>}
                      {r.reviewed_at && (
                        <div>
                          审批 {formatTime(r.reviewed_at)} {r.reviewer_name ? `· ${r.reviewer_name}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.status === "draft" && (
                          <>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                              onClick={() => setEditRow(r)}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-amber-700/70 hover:bg-amber-600/80"
                              onClick={async () => {
                                try {
                                  await api.affiliations.patch(r.id, { action: "submit" });
                                  load();
                                } catch (e) {
                                  setErr((e as Error).message);
                                }
                              }}
                            >
                              提交审批
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded border border-red-900/60 text-red-400 hover:bg-red-950/40"
                                onClick={() => setDeleteTarget(r)}
                              >
                                删除
                              </button>
                            )}
                          </>
                        )}
                        {r.status === "pending" && isAdmin && (
                          <>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                              onClick={() => setEditRow(r)}
                            >
                              修改资料
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600"
                              onClick={async () => {
                                const c = prompt("审批意见（可留空）", "同意");
                                if (c === null) return;
                                try {
                                  await api.affiliations.patch(r.id, {
                                    action: "approve",
                                    review_comment: c,
                                  });
                                  load();
                                } catch (e) {
                                  setErr((e as Error).message);
                                }
                              }}
                            >
                              通过
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800/60"
                              onClick={async () => {
                                const c = prompt("驳回原因", "");
                                if (c === null) return;
                                await api.affiliations.patch(r.id, {
                                  action: "reject",
                                  review_comment: c || "未填写原因",
                                });
                                load();
                              }}
                            >
                              驳回
                            </button>
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded border border-red-900/60 text-red-400 hover:bg-red-950/40"
                              onClick={() => setDeleteTarget(r)}
                            >
                              删除
                            </button>
                          </>
                        )}
                        {r.status === "pending" && !isAdmin && (
                          <span className="text-xs text-slate-500">待管理员审批</span>
                        )}
                        {r.status === "approved" && isAdmin && (
                          <div className="flex flex-col gap-1.5 items-start max-w-[260px]">
                            <span className="text-xs text-slate-600">{r.review_comment || "—"}</span>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                                onClick={() => setEditRow(r)}
                              >
                                修改资料
                              </button>
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded border border-red-900/60 text-red-400 hover:bg-red-950/40"
                                onClick={() => setDeleteTarget(r)}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        )}
                        {r.status === "approved" && !isAdmin && (
                          <span className="text-xs text-slate-600">{r.review_comment || "—"}</span>
                        )}
                        {r.status === "rejected" && (
                          <div className="flex flex-col gap-1.5 items-start max-w-[260px]">
                            <span className="text-xs text-slate-500">
                              驳回意见：{r.review_comment || "—"}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                                onClick={() => setEditRow(r)}
                              >
                                修改
                              </button>
                              <button
                                type="button"
                                className="text-xs px-2 py-1 rounded bg-blue-600/85 hover:bg-blue-600 text-white"
                                onClick={async () => {
                                  if (!confirm("确认再次提交审批？状态将变为「待审批」，管理员可重新审核。")) return;
                                  try {
                                    await api.affiliations.patch(r.id, { action: "resubmit" });
                                    load();
                                  } catch (e) {
                                    setErr((e as Error).message);
                                  }
                                }}
                              >
                                重新提交
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded border border-red-900/60 text-red-400 hover:bg-red-950/40"
                                  onClick={() => setDeleteTarget(r)}
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewAffiliationModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
      {editRow && (
        <EditAffiliationModal
          key={editRow.id}
          row={editRow}
          isAdmin={isAdmin}
          onClose={() => setEditRow(null)}
          onSaved={() => {
            setEditRow(null);
            load();
          }}
        />
      )}
      {viewRow && <ViewMaterialModal row={viewRow} onClose={() => setViewRow(null)} />}
      {deleteTarget && (
        <DeleteAffiliationConfirmModal
          row={deleteTarget}
          busy={deleteBusy}
          onClose={() => {
            if (!deleteBusy) setDeleteTarget(null);
          }}
          onConfirm={async () => {
            setDeleteBusy(true);
            setErr(null);
            try {
              await api.affiliations.remove(deleteTarget.id);
              setDeleteTarget(null);
              load();
            } catch (e) {
              setErr((e as Error).message);
            } finally {
              setDeleteBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function DeleteAffiliationConfirmModal({
  row,
  busy,
  onClose,
  onConfirm,
}: {
  row: AffiliationRequest;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const st = statusText[row.status] ?? row.status;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="presentation"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-aff-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 id="delete-aff-title" className="font-semibold text-white">
            确认删除挂靠申请
          </h3>
        </div>
        <div className="p-5 space-y-3 text-sm text-slate-300">
          <p>
            将永久删除申请人 <span className="text-white font-medium">{row.applicant_name}</span> 的申请（当前状态：
            <span className="text-slate-200"> {st}</span>
            ）。删除后不可恢复。
          </p>
          <p className="text-xs text-slate-500">
            {row.address_region}
            {row.detail_address ? ` · ${row.detail_address}` : " · 详细地址待分配"}
          </p>
        </div>
        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className="px-4 py-2 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-50"
          >
            {busy ? "删除中…" : "确认删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
      d.getHours(),
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-sm text-slate-200 break-all">{value && String(value).trim() ? value : "—"}</div>
    </div>
  );
}

function IdPhotoReadonly({ label, url }: { label: string; url: string | null | undefined }) {
  const v = url?.trim();
  if (!v) {
    return <Field label={label} value={null} />;
  }
  const asImg = v.startsWith("/api/") || /^https?:\/\//i.test(v);
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      {asImg ? (
        <img src={v} alt="" className="mt-1 max-h-44 rounded border border-slate-700 object-contain bg-black/20" />
      ) : (
        <div className="text-sm text-slate-200 break-all">{v}</div>
      )}
    </div>
  );
}

function ViewMaterialModal({ row, onClose }: { row: AffiliationRequest; onClose: () => void }) {
  const ct: AffiliationContactType = row.contact_type === "channel" ? "channel" : "direct";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 backdrop-blur">
          <div>
            <h3 className="font-semibold text-white">材料与联络人</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {contactLabel[ct]} · 申请人 {row.applicant_name}
              {row.group_name ? ` · 群 ${row.group_name}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none shrink-0">
            ×
          </button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <Field label="群名称" value={row.group_name} />
          {ct === "channel" && (
            <div className="rounded-lg border border-slate-800 p-3 space-y-2">
              <div className="text-xs font-medium text-violet-300/90">渠道</div>
              <Field label="渠道公司名" value={row.channel_company_name} />
              <Field label="常用联系人姓名" value={row.channel_common_contact_name} />
              <Field label="常用联系人电话" value={row.channel_common_contact_phone} />
              <Field label="备用联系人姓名" value={row.channel_backup_contact_name} />
              <Field label="备用联系人电话" value={row.channel_backup_contact_phone} />
            </div>
          )}
          <div className="rounded-lg border border-slate-800 p-3 space-y-2">
            <div className="text-xs font-medium text-sky-300/90">法人与企业备用联系人</div>
            <IdPhotoReadonly label="法人身份证正面" url={row.legal_id_front} />
            <IdPhotoReadonly label="法人身份证反面" url={row.legal_id_back} />
            <Field label="法人姓名" value={row.legal_name} />
            <Field label="法人身份证号" value={row.legal_id_number} />
            <Field label="法人手机" value={row.legal_phone} />
            <Field label="法人联系地址" value={row.legal_contact_address} />
            <Field label="法人邮箱" value={row.legal_email} />
            <Field label="企业备用联系人姓名" value={row.enterprise_backup_name} />
            <Field label="企业备用联系人电话" value={row.enterprise_backup_phone} />
          </div>
          <div className="rounded-lg border border-slate-800 p-3 space-y-2">
            <div className="text-xs font-medium text-slate-400">是否用于办理地址变更</div>
            <div className="text-slate-300">{row.need_address_change ? "是 · 须提供执照" : "否"}</div>
            {!!row.need_address_change && <IdPhotoReadonly label="执照照片" url={row.license_photo} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditAffiliationModal({
  row,
  isAdmin,
  onClose,
  onSaved,
}: {
  row: AffiliationRequest;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDraft = row.status === "draft";
  /** 管理员在待审批/已通过/已驳回时仅保存资料，不改变流程状态 */
  const adminMaintain = isAdmin && !isDraft;
  const [addressType, setAddressType] = useState<AddressType>(
    row.requested_address_type ?? row.address_type,
  );
  const [addressRegion, setAddressRegion] = useState(
    row.requested_address_region ?? row.address_region ?? "",
  );
  const [applicantName, setApplicantName] = useState(row.applicant_name);
  const [groupName, setGroupName] = useState(row.group_name ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [mat, setMat] = useState<MaterialFormState>(() => rowToMaterial(row));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const basePayload = () => ({
    requested_address_type: addressType,
    requested_address_region: addressRegion.trim(),
    applicant_name: applicantName.trim(),
    applicant_dept: "",
    group_name: groupName.trim() || null,
    notes: notes.trim() || null,
    ...materialToApiBody(mat),
  });

  async function saveDraft(e: FormEvent) {
    e.preventDefault();
    if (!addressRegion.trim()) {
      setMsg("请选择地址区域");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.affiliations.patch(row.id, basePayload());
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAndSubmit() {
    if (!addressRegion.trim()) {
      setMsg("请选择地址区域");
      return;
    }
    const formatErr = validateMaterialFormFormats(mat, { requireIdNumber: true });
    if (formatErr) {
      setMsg(formatErr);
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      if (isDraft) {
        await api.affiliations.patch(row.id, { ...basePayload(), action: "submit" });
      } else {
        await api.affiliations.patch(row.id, { ...basePayload(), action: "resubmit" });
      }
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <div>
            <h3 className="font-semibold text-white">
              {adminMaintain ? "管理员修改资料" : isDraft ? "编辑草稿" : "修改申请"}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {adminMaintain
                ? row.status === "approved"
                  ? "保存后仍为「已通过」；若修改地址类型/区域将按新条件重新分配详细地址。"
                  : row.status === "pending"
                    ? "保存后仍为「待审批」，审批状态不变。"
                    : "保存后仍为「已驳回」；修正后由业务员重新提交或您代为处理。"
                : isDraft
                  ? "保存后可点「保存并提交审批」；材料按清单校验。"
                  : "保存后请在列表中点「重新提交」送审，或在此一键保存并重新提交。"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none shrink-0">
            ×
          </button>
        </div>
        <form onSubmit={saveDraft} className="p-5 space-y-3">
          {!isDraft && row.status === "rejected" && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
              <span className="text-slate-500">上次驳回：</span>
              {row.review_comment || "—"}
            </div>
          )}
          {adminMaintain && row.status !== "rejected" && (
            <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
              当前状态：{statusText[row.status] ?? row.status}
              {row.status === "approved" && row.detail_address && (
                <span className="block mt-1 text-slate-400">已分配地址：{row.detail_address}</span>
              )}
            </div>
          )}
          <AffiliationAddressPreferenceFields
            addressType={addressType}
            addressRegion={addressRegion}
            onAddressTypeChange={setAddressType}
            onAddressRegionChange={setAddressRegion}
          />
          <label className="block text-xs text-slate-500">申请人 *</label>
          <input required value={applicantName} onChange={(e) => setApplicantName(e.target.value)} className={inputCls()} />
          <label className="block text-xs text-slate-500">群名称</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className={inputCls()}
            placeholder="服务群名称，便于后续联络"
          />
          <label className="block text-xs text-slate-500">说明</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls()} />
          <MaterialFormBody value={mat} onChange={(p) => setMat((prev) => ({ ...prev, ...p }))} />
          <div className="sticky bottom-0 -mx-5 px-5 pt-3 mt-2 border-t border-slate-800 bg-slate-950/95 backdrop-blur space-y-2">
            <FormSubmitAlert message={msg} />
            <div className="flex flex-wrap justify-end gap-2 pb-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${
                  adminMaintain ? "bg-blue-600 hover:bg-blue-500" : "bg-slate-600 hover:bg-slate-500"
                }`}
              >
                {saving ? "保存中…" : adminMaintain ? "保存" : "仅保存"}
              </button>
              {!adminMaintain && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveAndSubmit()}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? "处理中…" : isDraft ? "保存并提交审批" : "保存并重新提交"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewAffiliationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [addressType, setAddressType] = useState<AddressType>("coworking");
  const [addressRegion, setAddressRegion] = useState("");
  const [applicantName, setApplicantName] = useState(() => user?.displayName ?? "");
  const [groupName, setGroupName] = useState("");
  const [notes, setNotes] = useState("");
  const [mat, setMat] = useState<MaterialFormState>(emptyMaterial);
  const [submitNow, setSubmitNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user?.displayName) {
      setApplicantName((prev) => (prev.trim() === "" ? user.displayName : prev));
    }
  }, [user?.displayName]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!addressRegion.trim()) {
      setMsg("请选择地址区域");
      return;
    }
    const formatErr = validateMaterialFormFormats(mat, { requireIdNumber: submitNow });
    if (formatErr) {
      setMsg(formatErr);
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.affiliations.create({
        requested_address_type: addressType,
        requested_address_region: addressRegion.trim(),
        applicant_name: applicantName.trim(),
        applicant_dept: "",
        group_name: groupName.trim() || undefined,
        notes: notes || undefined,
        status: submitNow ? "pending" : undefined,
        ...materialToApiBody(mat),
      });
      onCreated();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-950 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-950/95 backdrop-blur z-10">
          <h3 className="font-semibold text-white">新建挂靠申请</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">
            ×
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <AffiliationAddressPreferenceFields
            addressType={addressType}
            addressRegion={addressRegion}
            onAddressTypeChange={setAddressType}
            onAddressRegionChange={setAddressRegion}
          />
          <label className="block text-xs text-slate-500">申请人 *</label>
          <input
            required
            value={applicantName}
            onChange={(e) => setApplicantName(e.target.value)}
            className={inputCls()}
          />
          <label className="block text-xs text-slate-500">群名称</label>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className={inputCls()}
            placeholder="服务群名称，便于后续联络"
          />
          <label className="block text-xs text-slate-500">说明</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls()} />
          <MaterialFormBody value={mat} onChange={(p) => setMat((prev) => ({ ...prev, ...p }))} />
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} />
            创建后直接提交审批（将校验材料必填项）
          </label>
          <div className="sticky bottom-0 -mx-5 px-5 pt-3 mt-2 border-t border-slate-800 bg-slate-950/95 backdrop-blur space-y-2">
            <FormSubmitAlert message={msg} />
            <div className="flex justify-end gap-2 pb-1">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-600">
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                {saving ? "提交中…" : "确定"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
