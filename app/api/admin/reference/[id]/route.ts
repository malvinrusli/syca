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

  const { data: file } = await supabase
    .from("reference_files")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createSupabaseServiceRoleClient();
  await admin.storage.from("reference-files").remove([file.storage_path]);

  const { error } = await supabase.from("reference_files").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
