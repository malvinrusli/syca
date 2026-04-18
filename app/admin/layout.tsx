import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Mail, Settings, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/skills", label: "Skills", icon: Sparkles },
  { href: "/admin/reference", label: "Reference files", icon: FileText },
  { href: "/admin/invites", label: "Invites", icon: Mail },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) redirect("/projects");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <aside className="flex h-full w-60 flex-col border-r bg-muted/30 p-4">
        <Link href="/projects" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
        <h2 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</h2>
        <nav className="space-y-0.5">
          {NAV.map((item) => (
            <AdminNavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function AdminNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
