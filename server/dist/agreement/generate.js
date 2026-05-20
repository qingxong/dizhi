import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { amountToChineseUpper } from "./amountCn.js";
import { AGREEMENT_GENERATED_DIR, AGREEMENT_TEMPLATE_FILE, UPLOADS_ROOT } from "./paths.js";
const execFileAsync = promisify(execFile);
const ADDRESS_TYPE_LABELS = {
    coworking: "集中办公区",
    business_secretary: "商务秘书",
    affiliation: "集中办公区",
};
export function buildAgreementTemplateData(row) {
    const amount = String(row.agreement_amount ?? "").trim();
    const todayStr = new Date().toISOString().slice(0, 10);
    return {
        enterprise_name: String(row.agreement_enterprise_name ?? ""),
        amount,
        amount_cn: amount ? amountToChineseUpper(amount) : "",
        service_start: String(row.agreement_service_start ?? ""),
        service_end: String(row.agreement_service_end ?? ""),
        legal_name: String(row.legal_name ?? ""),
        legal_phone: String(row.legal_phone ?? ""),
        legal_contact_address: String(row.legal_contact_address ?? ""),
        legal_email: String(row.legal_email ?? ""),
        applicant_name: String(row.applicant_name ?? ""),
        group_name: String(row.group_name ?? ""),
        address_type_label: ADDRESS_TYPE_LABELS[String(row.address_type)] ?? String(row.address_type ?? ""),
        address_region: String(row.address_region ?? ""),
        detail_address: String(row.detail_address ?? ""),
        service_type: String(row.service_type ?? ""),
        today: todayStr,
        agreement_no: String(row.id).slice(0, 12).toUpperCase(),
    };
}
export function templateFileInfo() {
    if (!existsSync(AGREEMENT_TEMPLATE_FILE)) {
        return { exists: false, updated_at: null, size: null };
    }
    const st = statSync(AGREEMENT_TEMPLATE_FILE);
    return { exists: true, updated_at: st.mtime.toISOString(), size: st.size };
}
function fillDocxBuffer(templatePath, data) {
    const content = readFileSync(templatePath);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });
    doc.render(data);
    return doc.getZip().generate({ type: "nodebuffer" });
}
async function tryConvertDocxToPdf(docxPath, outDir) {
    const candidates = [
        process.env.LIBREOFFICE_PATH,
        "soffice",
        "libreoffice",
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    ].filter(Boolean);
    for (const bin of candidates) {
        try {
            await execFileAsync(bin, ["--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath], { timeout: 120_000 });
            const pdfPath = join(outDir, `${basename(docxPath, ".docx")}.pdf`);
            if (existsSync(pdfPath))
                return pdfPath;
        }
        catch {
            /* try next */
        }
    }
    return null;
}
/** 生成协议文件，优先 PDF；无 LibreOffice 时保留 DOCX */
export async function generateAgreementDocument(affiliationId, row) {
    if (!existsSync(AGREEMENT_TEMPLATE_FILE)) {
        throw new Error("尚未上传 Word 协议模板，请联系管理员在「协议模板」页面上传");
    }
    const data = buildAgreementTemplateData(row);
    const buf = fillDocxBuffer(AGREEMENT_TEMPLATE_FILE, data);
    const outDir = join(AGREEMENT_GENERATED_DIR, affiliationId);
    mkdirSync(outDir, { recursive: true });
    const docxPath = join(outDir, "agreement.docx");
    writeFileSync(docxPath, buf);
    const pdfPath = await tryConvertDocxToPdf(docxPath, outDir);
    if (pdfPath) {
        return { relativePath: `agreements/generated/${affiliationId}/agreement.pdf`, format: "pdf" };
    }
    return { relativePath: `agreements/generated/${affiliationId}/agreement.docx`, format: "docx" };
}
export function resolveUnderUploads(relativePath) {
    const normalized = relativePath.replace(/^\/+/, "").replace(/\.\./g, "");
    if (!normalized.startsWith("agreements/")) {
        throw new Error("Invalid agreement file path");
    }
    return join(UPLOADS_ROOT, normalized);
}
export function saveUploadedTemplate(tempPath) {
    mkdirSync(dirname(AGREEMENT_TEMPLATE_FILE), { recursive: true });
    copyFileSync(tempPath, AGREEMENT_TEMPLATE_FILE);
}
