"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/lib/utils";
import { isImageMime } from "@/lib/files";
import { toggleReferenceFile } from "@/app/admin/actions";
import type { ReferenceFile } from "@/lib/db-types";

export function ReferenceRow({ file }: { file: ReferenceFile }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(file.enabled);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const Icon = isImageMime(file.mime_type) ? ImageIcon : FileText;

  function onToggle(v: boolean) {
    setEnabled(v);
    startTransition(async () => {
      try {
        await toggleReferenceFile(file.id, v);
      } catch (e) {
        setEnabled(!v);
        console.error(e);
      }
    });
  }

  async function onDelete() {
    if (!confirm(`Delete "${file.filename}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/reference/${file.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "delete failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <li className="flex items-center gap-4 px-6 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">{file.filename}</p>
        <p className="text-xs text-muted-foreground">
          {file.size_bytes ? formatBytes(file.size_bytes) : ""} {file.mime_type ? `· ${file.mime_type}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={onToggle} disabled={pending} />
        <Button variant="ghost" size="icon" onClick={onDelete} disabled={deleting}>
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </li>
  );
}
