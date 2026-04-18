"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth-guard";
import { isValidModel } from "@/lib/models";

const EmailSchema = z.string().trim().email().max(320);

export async function inviteMember(formData: FormData) {
  await requireAdmin();
  const email = EmailSchema.parse(formData.get("email"));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const admin = createSupabaseServiceRoleClient();

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/set-password`,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/invites");
  return { ok: true };
}

export async function setDefaultModel(model: string) {
  await requireAdmin();
  if (!isValidModel(model)) throw new Error("invalid model");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "default_model", value: model }, { onConflict: "key" });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/settings");
}

export async function toggleSkill(id: string, enabled: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("skills").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/skills");
}

export async function toggleReferenceFile(id: string, enabled: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("reference_files").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/reference");
}
