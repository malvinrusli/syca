import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const form = await req.formData();
  const projectId = form.get("projectId");
  const file = form.get("file");

  if (typeof projectId !== "string" || !projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "file too large (30 MB max)" }, { status: 400 });
  }

  const mimeType = inferMime(file.name, file.type);
  if (!SUPPORTED_CLIENT_MIMES.has(mimeType)) {
    return NextResponse.json({ error: `unsupported type: ${mimeType}` }, { status: 400 });
  }

  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${projectId}/${crypto.randomUUID()}-${file.name}`;

  const admin = createSupabaseServiceRoleClient();
  const { error: storageErr } = await admin.storage
    .from("project-files")
    .upload(storagePath, rawBuffer, { contentType: mimeType, upsert: false });

  if (storageErr) {
    return NextResponse.json({ error: `storage: ${storageErr.message}` }, { status: 500 });
  }

  let uploadForClaude: { data: Buffer; filename: string; mimeType: string };
  if (isDocxMime(mimeType)) {
    const text = await convertDocxBufferToText(rawBuffer);
    uploadForClaude = {
      data: Buffer.from(text, "utf-8"),
      filename: file.name.replace(/\.docx$/i, ".txt"),
      mimeType: "text/plain",
    };
  } else {
    uploadForClaude = { data: rawBuffer, filename: file.name, mimeType };
  }

  let anthropicFileId: string | null = null;
  try {
    const { file_id } = await uploadToAnthropicFilesApi(uploadForClaude);
    anthropicFileId = file_id;
  } catch (e) {
    await admin.storage.from("project-files").remove([storagePath]);
    return NextResponse.json(
      { error: `anthropic files api: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 502 },
    );
  }

  const { data: row, error: dbErr } = await supabase
    .from("project_files")
    .insert({
      project_id: projectId,
      uploaded_by: user.id,
      storage_path: storagePath,
      anthropic_file_id: anthropicFileId,
      filename: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
    })
    .select()
    .single();

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, file: row });
}
