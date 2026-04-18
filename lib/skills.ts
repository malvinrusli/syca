import matter from "gray-matter";
import { getAnthropicClient, ANTHROPIC_BETAS } from "@/lib/anthropic";

export type ParsedSkillFile = {
  name: string;
  description: string;
  body: string;
  raw: string;
};

export function parseSkillMarkdown(raw: string): ParsedSkillFile {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  if (!name) throw new Error("Skill is missing `name` in frontmatter.");
  if (!description) throw new Error("Skill is missing `description` in frontmatter.");
  if (name.length > 80) throw new Error("`name` must be 80 characters or fewer.");
  return { name, description, body: parsed.content.trim(), raw };
}

export async function createAnthropicSkill(params: {
  name: string;
  rawMarkdown: string;
}): Promise<{ skill_id: string }> {
  const blob = new Blob([params.rawMarkdown], { type: "text/markdown" });
  const file = new File([blob], "SKILL.md", { type: "text/markdown" });
  const client = getAnthropicClient();
  const skill = await client.beta.skills.create({
    display_title: params.name,
    files: [file],
    betas: ANTHROPIC_BETAS,
  });
  return { skill_id: skill.id };
}
