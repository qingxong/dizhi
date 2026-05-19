import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const AGREEMENT_TEMPLATE_DIR = join(__dirname, "..", "..", "data", "agreement-template");
export const AGREEMENT_TEMPLATE_FILE = join(AGREEMENT_TEMPLATE_DIR, "template.docx");
export const UPLOADS_ROOT = join(__dirname, "..", "..", "data", "uploads");
export const AGREEMENT_UPLOADS_ROOT = join(UPLOADS_ROOT, "agreements");
export const AGREEMENT_GENERATED_DIR = join(AGREEMENT_UPLOADS_ROOT, "generated");
export const AGREEMENT_SIGNED_DIR = join(AGREEMENT_UPLOADS_ROOT, "signed");

mkdirSync(AGREEMENT_TEMPLATE_DIR, { recursive: true });
mkdirSync(AGREEMENT_GENERATED_DIR, { recursive: true });
mkdirSync(AGREEMENT_SIGNED_DIR, { recursive: true });
