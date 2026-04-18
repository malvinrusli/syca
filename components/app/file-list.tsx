"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { isImageMime } from "@/lib/files";

type FileItem = {
  id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  anthropic_file_id?: string | null;
};

export function FileList({
  files,
  deleteEndpoint,
}: {
  files: FileItem[];
  deleteEndpoint: (id: string) => string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function del(id: string) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(deleteEndpoint(id), { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "delete failed" }));
          throw new Error(body.error || `delete failed: ${res.status}`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setPendingId(null);
      }
    });
  }

  if (files.length === 0) {
    return <p className="px-2 py-4 text-sm text-muted-foreground">No files yet.</p>;
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
      <ul className="space-y-1">
        {files.map((f) => {
          const Icon = isImageMime(f.mime_type) ? ImageIcon : FileText;
          const pending = pendingId === f.id;
          return (
            <li key={f.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{f.filename}</span>
              <span className="text-xs text-muted-foreground">
                {f.size_bytes ? formatBytes(f.size_bytes) : ""}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={pending}
                onClick={() => del(f.id)}
                aria-label={`Delete ${f.filename}`}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
