import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "forbidden";
    return NextResponse.json({ error: msg }, { status: msg === "unauthenticated" ? 401 : 403 });
  }

  const { data: skill } = await supabase
    .from("skills")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!skill) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createSupabaseServiceRoleClient();
  await admin.storage.from("skills").remove([skill.storage_path]);

  const { error } = await supabase.from("skills").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
