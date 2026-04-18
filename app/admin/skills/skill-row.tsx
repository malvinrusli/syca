"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toggleSkill } from "@/app/admin/actions";
import type { Skill } from "@/lib/db-types";

export function SkillRow({ skill }: { skill: Skill }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(skill.enabled);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  function onToggle(v: boolean) {
    setEnabled(v);
    startTransition(async () => {
      try {
        await toggleSkill(skill.id, v);
      } catch (e) {
        setEnabled(!v);
        console.error(e);
      }
    });
  }

  async function onDelete() {
    if (!confirm(`Delete skill "${skill.name}"? This removes it from the Anthropic Skills API too.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/skills/${skill.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "delete failed");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{skill.name}</h3>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{skill.anthropic_skill_id}</code>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{skill.description}</p>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={onToggle} disabled={pending} />
        <Button variant="ghost" size="icon" onClick={onDelete} disabled={deleting} aria-label="Delete skill">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </li>
  );
}
