import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChatView } from "@/components/chat/chat-view";
import type { Conversation, DbMessage, Project } from "@/lib/db-types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!conv) notFound();

  const [{ data: msgs }, { data: project }] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    conv.project_id
      ? supabase.from("projects").select("*").eq("id", conv.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="flex h-full flex-col">
      {project && (
        <div className="border-b px-6 py-2 text-xs text-muted-foreground">
          In project{" "}
          <Link href={`/projects/${(project as Project).id}`} className="font-medium text-foreground hover:underline">
            {(project as Project).name}
          </Link>
        </div>
      )}
      <ChatView
        conversation={conv as Conversation}
        initialMessages={(msgs ?? []) as DbMessage[]}
        project={(project as Project | null) ?? null}
      />
    </div>
  );
}
