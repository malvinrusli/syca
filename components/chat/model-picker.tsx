"use client";

import { MODELS, type ModelId } from "@/lib/models";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ModelPicker({
  value,
  onChange,
}: {
  value: ModelId;
  onChange: (id: ModelId) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ModelId)}>
      <SelectTrigger className="h-8 w-auto gap-2 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:bg-accent">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {MODELS.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
