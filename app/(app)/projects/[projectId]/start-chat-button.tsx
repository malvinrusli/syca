"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createConversation } from "@/app/(app)/actions";

export function StartChatButton({ projectId, variant }: { projectId: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const id = await createConversation(projectId);
      router.push(`/chat/${id}`);
    });
  }

  return (
    <Button size="sm" variant={variant ?? "default"} onClick={start} disabled={pending}>
      <Plus className="mr-2 h-4 w-4" /> {pending ? "Starting…" : "New chat"}
    </Button>
  );
}
