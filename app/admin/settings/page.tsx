import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_MODEL, isValidModel } from "@/lib/models";
import { SettingsForm } from "./settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("app_settings").select("*").eq("key", "default_model").maybeSingle();
  const current = typeof data?.value === "string" && isValidModel(data.value) ? data.value : DEFAULT_MODEL;

  const { count: memberCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: convoCount } = await supabase.from("conversations").select("*", { count: "exact", head: true });
  const { count: skillCount } = await supabase
    .from("skills")
    .select("*", { count: "exact", head: true })
    .eq("enabled", true);

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="mb-6 text-xl font-semibold">Settings</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Default model</CardTitle>
          <CardDescription>Used for new conversations unless the user picks another.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm current={current} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">At a glance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Members" value={String(memberCount ?? 0)} />
          <Row label="Conversations" value={String(convoCount ?? 0)} />
          <Row label="Enabled skills" value={String(skillCount ?? 0)} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
