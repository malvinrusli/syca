import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FileUploader } from "@/components/app/file-uploader";
import { ReferenceRow } from "./reference-row";
import type { ReferenceFile } from "@/lib/db-types";

export default async function ReferenceAdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("reference_files")
    .select("*")
    .order("created_at", { ascending: false });
  const files = (data ?? []) as ReferenceFile[];

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Reference files</h1>
          <p className="text-sm text-muted-foreground">
            Global docs Claude can reference in every project. Supported: PDF, txt, md, csv, docx, images.
          </p>
        </div>
        <FileUploader endpoint="/api/admin/reference" />
      </div>

      <div className="rounded-lg border">
        {files.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No reference files yet.</p>
        ) : (
          <ul className="divide-y">
            {files.map((f) => (
              <ReferenceRow key={f.id} file={f} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
