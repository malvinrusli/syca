export const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-6";

export function isValidModel(id: string): id is ModelId {
  return MODELS.some((m) => m.id === id);
}

export function labelForModel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}
