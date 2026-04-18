import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { Sidebar } from "@/components/app/sidebar";
import type { Conversation, Project } from "@/lib/db-types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [projectsRes, conversationsRes] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }).limit(100),
    supabase
      .from("conversations")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const projects = (projectsRes.data ?? []) as Project[];
  const conversations = (conversationsRes.data ?? []) as Conversation[];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        projects={projects}
        conversations={conversations}
        userEmail={user.email ?? ""}
        isAdmin={isAdminEmail(user.email)}
      />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
