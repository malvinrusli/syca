import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { StartChatButton } from "./start-chat-button";
import { ProjectSettings } from "./project-settings";
import { FileUploader } from "@/components/app/file-uploader";
import { FileList } from "@/components/app/file-list";
import type { Conversation, Project, ProjectFile } from "@/lib/db-types";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const [projectRes, filesRes, convsRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
    supabase.from("project_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("*")
      .eq("project_id", projectId)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const project = projectRes.data as Project | null;
  if (!project) notFound();
  const files = (filesRes.data ?? []) as ProjectFile[];
  const conversations = (convsRes.data ?? []) as Conversation[];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <header className="border-b px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{project.name}</h1>
            {project.system_prompt && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.system_prompt}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StartChatButton projectId={project.id} />
            <ProjectSettings project={project} />
          </div>
        </div>
      </header>

      <div className="grid flex-1 gap-6 px-8 py-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Reference files ({files.length})
            </h2>
            <FileUploader projectId={project.id} />
          </div>
          <Card>
            <CardContent className="p-2">
              <FileList files={files} deleteEndpoint={(id) => `/api/files/${id}`} />
            </CardContent>
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">
            Supported: PDF, txt, md, csv, docx, png, jpg, webp. Up to 30 MB each.
          </p>
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MessageSquare className="h-4 w-4" /> My chats in this project ({conversations.length})
          </h2>
          <Card>
            <CardContent className="p-2">
              {conversations.length === 0 ? (
                <div className="px-2 py-4 text-center">
                  <p className="mb-3 text-sm text-muted-foreground">No chats yet.</p>
                  <StartChatButton projectId={project.id} variant="outline" />
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/chat/${c.id}`}
                        className="block truncate rounded-md px-3 py-2 text-sm hover:bg-accent"
                      >
                        {c.title || "Untitled chat"}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
