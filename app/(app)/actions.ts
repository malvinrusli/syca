"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_MODEL, isValidModel } from "@/lib/models";

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return { supabase, user };
}

const ProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  system_prompt: z.string().max(4000).nullish(),
});

export async function createProject(formData: FormData) {
  const { supabase, user } = await getUser();
  const parsed = ProjectSchema.parse({
    name: formData.get("name"),
    system_prompt: (formData.get("system_prompt") as string) || null,
  });

  const { data, error } = await supabase
    .from("projects")
    .insert({ name: parsed.name, system_prompt: parsed.system_prompt ?? null, created_by: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const { supabase } = await getUser();
  const parsed = ProjectSchema.parse({
    name: formData.get("name"),
    system_prompt: (formData.get("system_prompt") as string) || null,
  });
  const { error } = await supabase
    .from("projects")
    .update({ name: parsed.name, system_prompt: parsed.system_prompt ?? null })
    .eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function deleteProject(projectId: string) {
  const { supabase } = await getUser();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function createConversation(projectId: string | null, model?: string) {
  const { supabase, user } = await getUser();
  const selected = model && isValidModel(model) ? model : DEFAULT_MODEL;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      project_id: projectId,
      owner_id: user.id,
      model: selected,
      title: null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  return data.id as string;
}

export async function deleteConversation(conversationId: string) {
  const { supabase } = await getUser();
  const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects");
  redirect("/projects");
}

export async function renameConversation(conversationId: string, title: string) {
  const { supabase } = await getUser();
  const clean = title.trim().slice(0, 200);
  const { error } = await supabase.from("conversations").update({ title: clean }).eq("id", conversationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/chat/${conversationId}`);
}

export async function setConversationModel(conversationId: string, model: string) {
  if (!isValidModel(model)) throw new Error("invalid model");
  const { supabase } = await getUser();
  const { error } = await supabase.from("conversations").update({ model }).eq("id", conversationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/chat/${conversationId}`);
}
