import { join } from "node:path";
import multer from "multer";
import { nanoid } from "nanoid";
import { AGREEMENT_SIGNED_DIR, AGREEMENT_TEMPLATE_DIR } from "./paths.js";
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
export const agreementSignedMulter = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, AGREEMENT_SIGNED_DIR),
        filename: (_req, file, cb) => {
            const ext = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf") ? ".pdf" : "";
            cb(null, ext ? `${nanoid(20)}${ext}` : `${nanoid(20)}.pdf`);
        },
    }),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
        if (ok)
            cb(null, true);
        else
            cb(new Error("请上传 PDF 格式的盖章协议"));
    },
});
export function signedPathForAffiliation(affiliationId) {
    return join(AGREEMENT_SIGNED_DIR, `${affiliationId}.pdf`);
}
