"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Folder, MessageSquare, Plus, Settings, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Conversation, Project } from "@/lib/db-types";
import { cn } from "@/lib/utils";

export function Sidebar({
  projects,
  conversations,
  userEmail,
  isAdmin,
}: {
  projects: Project[];
  conversations: Conversation[];
  userEmail: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-muted/30">
      <div className="p-4">
        <Link href="/projects" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">S</div>
          <span className="text-sm font-semibold">SYCA AI</span>
        </Link>
      </div>
      <div className="px-3 pb-2">
        <Button asChild className="w-full justify-start gap-2" size="sm">
          <Link href="/chat/new">
            <Plus className="h-4 w-4" /> New chat
          </Link>
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <SidebarSection title="Recent chats" icon={MessageSquare}>
          {conversations.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No chats yet.</p>
          ) : (
            conversations.map((c) => (
              <SidebarLink key={c.id} href={`/chat/${c.id}`} active={pathname === `/chat/${c.id}`}>
                {c.title || "Untitled chat"}
              </SidebarLink>
            ))
          )}
        </SidebarSection>

        <SidebarSection title="Projects" icon={Folder}>
          <SidebarLink href="/projects" active={pathname === "/projects"}>All projects</SidebarLink>
          {projects.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No projects yet.</p>
          ) : (
            projects.map((p) => (
              <SidebarLink key={p.id} href={`/projects/${p.id}`} active={pathname === `/projects/${p.id}`}>
                {p.name}
              </SidebarLink>
            ))
          )}
        </SidebarSection>
      </ScrollArea>

      <div className="border-t p-3">
        <div className="mb-2 truncate px-2 text-xs text-muted-foreground">{userEmail}</div>
        {isAdmin && (
          <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
            <Link href="/admin">
              <Shield className="h-4 w-4" /> Admin
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="sm" className="w-full justify-start gap-2">
          <Link href="/account">
            <Settings className="h-4 w-4" /> Account
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}

function SidebarSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "block truncate rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}
