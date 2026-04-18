import { getAnthropicClient, ANTHROPIC_BETAS } from "@/lib/anthropic";
import mammoth from "mammoth";

export const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB per file

// Supported client-uploaded types. We map docx to text/plain before forwarding to Claude.
export const SUPPORTED_CLIENT_MIMES = new Set<string>([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".csv", ".docx", ".png", ".jpg", ".jpeg", ".webp"];

export function isImageMime(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return mime.startsWith("image/");
}

export function isDocxMime(mime: string | null | undefined): boolean {
  return mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

export function extensionFor(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i).toLowerCase() : "";
}

export function inferMime(filename: string, declared: string | undefined): string {
  if (declared && declared !== "application/octet-stream") return declared;
  const ext = extensionFor(filename);
  switch (ext) {
    case ".pdf": return "application/pdf";
    case ".txt": return "text/plain";
    case ".md": return "text/markdown";
    case ".csv": return "text/csv";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: return declared ?? "application/octet-stream";
  }
}

export async function convertDocxBufferToText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

export async function uploadToAnthropicFilesApi(params: {
  data: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ file_id: string }> {
  const { data, filename, mimeType } = params;
  const blob = new Blob([new Uint8Array(data)], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });
  const client = getAnthropicClient();
  const result = await client.beta.files.upload({ file, betas: ANTHROPIC_BETAS });
  return { file_id: result.id };
}
