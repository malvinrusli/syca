import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createAnthropicSkill, parseSkillMarkdown } from "@/lib/skills";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SKILL_SIZE = 200 * 1024; // 200 KB

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
  if (!file.name.toLowerCase().endsWith(".md")) {
    return NextResponse.json({ error: "upload a .md file" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_SKILL_SIZE) {
    return NextResponse.json({ error: "file must be 1-200 KB" }, { status: 400 });
  }

  const raw = await file.text();
  let parsed;
  try {
    parsed = parseSkillMarkdown(raw);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid skill file" },
      { status: 400 },
    );
  }

  const storagePath = `${parsed.name}/${crypto.randomUUID()}.md`;
  const admin = createSupabaseServiceRoleClient();
  const { error: storageErr } = await admin.storage
    .from("skills")
    .upload(storagePath, raw, { contentType: "text/markdown", upsert: false });
  if (storageErr) {
    return NextResponse.json({ error: `storage: ${storageErr.message}` }, { status: 500 });
  }

  let skillId: string;
  try {
    const res = await createAnthropicSkill({ name: parsed.name, rawMarkdown: raw });
    skillId = res.skill_id;
  } catch (e) {
    await admin.storage.from("skills").remove([storagePath]);
    return NextResponse.json(
      { error: `anthropic skills api: ${e instanceof Error ? e.message : "unknown"}` },
      { status: 502 },
    );
  }

  const { data: existing } = await supabase.from("skills").select("id").eq("name", parsed.name).maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("skills")
      .update({
        description: parsed.description,
        anthropic_skill_id: skillId,
        storage_path: storagePath,
        version: "latest",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("skills").insert({
      name: parsed.name,
      description: parsed.description,
      anthropic_skill_id: skillId,
      storage_path: storagePath,
      version: "latest",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, skill_id: skillId, name: parsed.name });
}
