"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORTED_EXTENSIONS } from "@/lib/files";

export function FileUploader({
  projectId,
  endpoint = "/api/files/upload",
  extraFields,
}: {
  projectId?: string;
  endpoint?: string;
  extraFields?: Record<string, string>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError(null);
    setUploading(true);

    try {
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        if (projectId) form.append("projectId", projectId);
        if (extraFields) for (const [k, v] of Object.entries(extraFields)) form.append(k, v);

        const res = await fetch(endpoint, { method: "POST", body: form });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "upload failed" }));
          throw new Error(body.error || `upload failed: ${res.status}`);
        }
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={SUPPORTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={onSelect}
      />
      <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {uploading ? "Uploading…" : "Upload files"}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
