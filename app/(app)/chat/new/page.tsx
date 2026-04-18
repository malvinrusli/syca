import { redirect } from "next/navigation";
import { createConversation } from "@/app/(app)/actions";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const id = await createConversation(projectId ?? null);
  redirect(`/chat/${id}`);
}
