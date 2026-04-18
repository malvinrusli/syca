export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: "member" | "admin";
  created_at: string;
};

export type Project = {
  id: string;
  created_by: string | null;
  name: string;
  system_prompt: string | null;
  created_at: string;
};

export type ProjectFile = {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  storage_path: string;
  anthropic_file_id: string | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  project_id: string | null;
  owner_id: string;
  title: string | null;
  model: string;
  created_at: string;
};

export type CacheControl = { type: "ephemeral" };

export type MessageContentBlock =
  | { type: "text"; text: string; cache_control?: CacheControl }
  | { type: "document"; source: { type: "file"; file_id: string }; cache_control?: CacheControl }
  | { type: "image"; source: { type: "file"; file_id: string }; cache_control?: CacheControl };

export type DbMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: MessageContentBlock[];
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_tokens: number | null;
  cache_read_tokens: number | null;
  created_at: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  anthropic_skill_id: string;
  version: string;
  storage_path: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ReferenceFile = {
  id: string;
  storage_path: string;
  anthropic_file_id: string | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  enabled: boolean;
  created_at: string;
};
