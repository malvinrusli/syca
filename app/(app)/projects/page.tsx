import Link from "next/link";
import { Folder, Plus } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProjectDialog } from "./new-project-dialog";
import type { Project } from "@/lib/db-types";

export default async function ProjectsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  const projects = (data ?? []) as Project[];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="flex items-center justify-between border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Shared across all SYCA members.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/chat/new">
              <Plus className="mr-2 h-4 w-4" /> New chat
            </Link>
          </Button>
          <NewProjectDialog />
        </div>
      </header>

      <div className="flex-1 px-8 py-6">
        {projects.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <Folder className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
              <p className="mb-4 text-sm text-muted-foreground">No projects yet.</p>
              <NewProjectDialog />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                <Card className="h-full transition-colors hover:border-foreground/30">
                  <CardHeader>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.system_prompt && (
                      <CardDescription className="line-clamp-2">{p.system_prompt}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
