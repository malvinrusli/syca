import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FileUploader } from "@/components/app/file-uploader";
import { SkillRow } from "./skill-row";
import type { Skill } from "@/lib/db-types";

export default async function SkillsAdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("skills").select("*").order("created_at", { ascending: false });
  const skills = (data ?? []) as Skill[];

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Skills</h1>
          <p className="text-sm text-muted-foreground">
            Upload a `.md` file with `name` and `description` frontmatter. Claude auto-picks enabled skills per message.
          </p>
        </div>
        <SkillUploader />
      </div>

      <div className="rounded-lg border">
        {skills.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No skills yet.</p>
        ) : (
          <ul className="divide-y">
            {skills.map((s) => (
              <SkillRow key={s.id} skill={s} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SkillUploader() {
  return (
    <div className="flex items-center gap-2">
      <FileUploader endpoint="/api/admin/skills" />
    </div>
  );
}
