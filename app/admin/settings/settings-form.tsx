"use client";

import { useState, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MODELS, type ModelId } from "@/lib/models";
import { setDefaultModel } from "@/app/admin/actions";

export function SettingsForm({ current }: { current: ModelId }) {
  const [value, setValue] = useState<ModelId>(current);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMsg(null);
    startTransition(async () => {
      try {
        await setDefaultModel(value);
        setMsg("Saved.");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <Select value={value} onValueChange={(v) => setValue(v as ModelId)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
