import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  if (!isAdminEmail(user.email)) throw new Error("forbidden");
  return { supabase, user };
}
