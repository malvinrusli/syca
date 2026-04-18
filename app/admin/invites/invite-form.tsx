"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteMember } from "@/app/admin/actions";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    fd.set("email", email);
    startTransition(async () => {
      try {
        await inviteMember(fd);
        setMsg({ kind: "ok", text: `Invite sent to ${email}` });
        setEmail("");
      } catch (e) {
        setMsg({ kind: "err", text: e instanceof Error ? e.message : "Invite failed" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {msg && (
        <p className={msg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{msg.text}</p>
      )}
      <Button type="submit" disabled={pending || !email}>
        {pending ? "Sending…" : "Send invite"}
      </Button>
    </form>
  );
}
