import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { nanoid } from "nanoid";
const __dirname = dirname(fileURLToPath(import.meta.url));
/** 与 addresses.db 同级的上传目录（已在 .gitignore 的 server/data/ 下） */
export const ID_PHOTO_UPLOAD_DIR = join(__dirname, "..", "data", "uploads");
mkdirSync(ID_PHOTO_UPLOAD_DIR, { recursive: true });
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
function extFromMime(m) {
    if (m === "image/jpeg")
        return ".jpg";
    if (m === "image/png")
        return ".png";
    if (m === "image/webp")
        return ".webp";
    return "";
}
export const idPhotoMulter = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, ID_PHOTO_UPLOAD_DIR),
        filename: (_req, file, cb) => {
            const ext = extFromMime(file.mimetype) || ".jpg";
            cb(null, `${nanoid(24)}${ext}`);
        },
    }),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED.has(file.mimetype))
            cb(null, true);
        else
            cb(new Error("仅支持 JPEG、PNG、WebP 图片"));
    },
});
