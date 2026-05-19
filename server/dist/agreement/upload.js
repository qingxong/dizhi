import { extname, join } from "node:path";
import multer from "multer";
import { nanoid } from "nanoid";
import { AGREEMENT_SIGNED_DIR, AGREEMENT_TEMPLATE_DIR } from "./paths.js";
/** 从原始文件名取安全扩展名（无则空字符串） */
export function safeFileExt(originalname) {
    const ext = extname(originalname).toLowerCase();
    if (!ext || ext.length > 12)
        return "";
    if (!/^\.[a-z0-9]+$/.test(ext))
        return "";
    return ext;
}
export const agreementTemplateMulter = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, AGREEMENT_TEMPLATE_DIR),
        filename: (_req, _file, cb) => cb(null, `upload-${nanoid(8)}.docx`),
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.originalname.toLowerCase().endsWith(".docx");
        if (ok)
            cb(null, true);
        else
            cb(new Error("请上传 .docx 格式的 Word 模板"));
    },
});
/** 回传盖章协议：暂不限制文件格式，单文件最大 25MB */
export const agreementSignedMulter = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, AGREEMENT_SIGNED_DIR),
        filename: (_req, file, cb) => {
            const ext = safeFileExt(file.originalname);
            cb(null, `${nanoid(20)}${ext}`);
        },
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
});
export function signedPathForAffiliation(affiliationId, ext = "") {
    return join(AGREEMENT_SIGNED_DIR, `${affiliationId}${ext}`);
}
