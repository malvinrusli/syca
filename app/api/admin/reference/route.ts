import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_CLIENT_MIMES,
  convertDocxBufferToText,
  inferMime,
  isDocxMime,
  uploadToAnthropicFilesApi,
} from "@/lib/files";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "forbidden";
    return NextResponse.json({ error: msg }, { status: msg === "unauthenticated" ? 401 : 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "file must be 1 byte - 30 MB" }, { status: 400 });
  }

  const mimeType = inferMime(file.name, file.type);
  if (!SUPPORTED_CLIENT_MIMES.has(mimeType)) {
    return NextResponse.json({ error: `unsupported type: ${mimeType}` }, { status: 400 });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const storagePath = `${crypto.randomUUID()}-${file.name}`;
  const adminClient = createSupabaseServiceRoleClient();

  const { error: storageErr } = await adminClient.storage
    .from("reference-files")
    .upload(storagePath, raw, { contentType: mimeType, upsert: false });
  if (storageErr) {
    return NextResponse.json({ error: `storage: ${storageErr.message}` }, { status: 500 });
  }

  const forClaude = isDocxMime(mimeType)
    ? {
        data: Buffer.from(await convertDocxBufferToText(raw), "utf-8"),
        filename: file.name.replace(/\.docx$/i, ".txt"),
        mimeType: "text/plain",
      }
    : { data: raw, filename: file.name, mimeType };

  let anthropicFileId: string | null = null;
  try {
    const { file_id } = await uploadToAnthropicFilesApi(forClaude);
    anthropicFileId = file_id;
  } catch (e) {
    await adminClient.storage.from("reference-files").remove([storagePath]);
    return NextResponse.json(
      { error: `anthropic files api: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 502 },
    );
  }

  const { data: row, error: dbErr } = await supabase
    .from("reference_files")
    .insert({
      storage_path: storagePath,
      anthropic_file_id: anthropicFileId,
      filename: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, file: row });
}
