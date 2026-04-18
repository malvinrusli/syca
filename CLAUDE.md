# SYCA Chat — Personal Branding SaaS

A Claude-style chat app for **startyourcontentacademy.com**. Members sign in, chat with Claude, work inside Projects with uploaded reference files, and pick which model answers (Haiku 4.5 / Sonnet 4.5 / Sonnet 4.6 / Opus 4.6). Admins curate Skills and a shared Reference Folder that power every project.

Think: a Claude.ai clone with a SYCA skin, a members-only login, and an admin panel for skills/reference.

---

## Tech Stack

| Layer        | Choice                                                            |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | Next.js 15 (App Router) on Vercel, React 19, Tailwind, shadcn/ui  |
| Auth         | Supabase Auth (email + password, optional Google OAuth)           |
| Database     | Supabase Postgres (RLS on every table)                            |
| File storage | Supabase Storage + Anthropic Files API (beta) for reference files |
| LLM          | `@anthropic-ai/sdk` — Messages API with streaming                 |
| Hosting      | Vercel (Edge for auth middleware, Node for `/api/chat` streaming) |

**Why Anthropic SDK, not Agent SDK:** Agent SDK is built for autonomous CLI agents with filesystem-based skills. We need cloud-hosted, DB-stored skills and full control over the chat loop — the Messages API fits directly.

---

## Models

Exposed in a model-picker dropdown, stored per-conversation:

| Label            | Model ID                      |
| ---------------- | ----------------------------- |
| Haiku 4.5        | `claude-haiku-4-5-20251001`   |
| Sonnet 4.5       | `claude-sonnet-4-5-20250929`  |
| Sonnet 4.6       | `claude-sonnet-4-6`           |
| Opus 4.6         | `claude-opus-4-6`             |

Default: Sonnet 4.6. Admin can change the global default.

---

## Core Features

1. **Auth** — Supabase email/password. Session cookie, middleware-protected routes.
2. **Chat** — Streaming responses (SSE), markdown rendering, code blocks, copy/regenerate.
3. **Projects** — Group conversations. Each project has its own reference files and system prompt. Conversations live under a project.
4. **Files (per-project)** — Upload PDFs / text / images. Stored in Supabase Storage, also uploaded to Anthropic Files API; `file_id` attached to every message in that project.
5. **Admin panel** (`/admin`, admin role only)
   - **Skills** — CRUD: name, description, markdown instructions. Every chat automatically injects enabled skills into the system prompt.
   - **Reference folder** — global files available to every project, merged with project files.
   - **Default model** and usage stats.
6. **Model picker** — per-conversation.
7. **Prompt caching** — System prompt + skills + reference files + project files are marked `cache_control: ephemeral` so repeat messages in a conversation cost ~10% of the first.

---

## Database Schema (Supabase)

```sql
-- profiles: extends auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  system_prompt text,
  created_at timestamptz default now()
);

create table project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,          -- supabase storage key
  anthropic_file_id text,              -- files API id
  filename text not null,
  mime_type text,
  size_bytes int,
  created_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  title text,
  model text not null default 'claude-sonnet-4-6',
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content jsonb not null,              -- content blocks
  input_tokens int, output_tokens int,
  cache_creation_tokens int, cache_read_tokens int,
  created_at timestamptz default now()
);

-- admin-managed, global
create table skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,           -- short, for when-to-use routing
  instructions text not null,          -- markdown body
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table reference_files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  anthropic_file_id text,
  filename text not null,
  mime_type text,
  size_bytes int,
  enabled boolean not null default true,
  created_at timestamptz default now()
);

create table app_settings (
  key text primary key,
  value jsonb not null
);  -- e.g. { default_model: "claude-sonnet-4-6" }
```

RLS: users see only their own projects/conversations/messages; skills + reference_files are readable by all authenticated users, writable only by `role='admin'`.

---

## Directory Layout

```
syca/
├─ app/
│  ├─ (auth)/login/, signup/
│  ├─ (app)/
│  │  ├─ chat/[conversationId]/
│  │  ├─ projects/[projectId]/
│  │  └─ layout.tsx                 # sidebar w/ projects + conversations
│  ├─ admin/
│  │  ├─ skills/
│  │  ├─ reference/
│  │  └─ settings/
│  └─ api/
│     ├─ chat/route.ts              # SSE streaming
│     ├─ files/upload/route.ts
│     └─ admin/…
├─ lib/
│  ├─ anthropic.ts                  # client + buildSystemPrompt()
│  ├─ supabase/{server,client,middleware}.ts
│  └─ models.ts                     # MODEL_IDS constant
├─ components/ui/…
├─ middleware.ts                    # auth gate
└─ supabase/migrations/0001_init.sql
```

---

## Chat Request Flow

1. Client POSTs `{ conversationId, userMessage }` to `/api/chat`.
2. Server loads: conversation (for model + project), project files, enabled skills, enabled reference files, prior messages.
3. Build `system` array with cache_control markers:
   - base instructions (cache)
   - skills block (cache)
   - reference files as `document` blocks with `file_id` (cache)
   - project files as `document` blocks with `file_id` (cache)
   - project system_prompt (cache)
4. `anthropic.messages.stream({...})` → SSE to client.
5. On stream end: persist assistant message + token counts.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=           # server only
ANTHROPIC_API_KEY=                   # server only
```

---

## Build Milestones

- **M1** — Scaffold Next.js, Supabase auth, login/signup, protected layout.
- **M2** — Projects + conversations CRUD, basic chat (no files, one model).
- **M3** — Model picker + streaming + markdown rendering + message persistence.
- **M4** — Project file upload → Supabase Storage + Anthropic Files API, wired into request.
- **M5** — Admin panel: skills CRUD + reference folder + default model + role gate.
- **M6** — Prompt caching, token usage display, polish, SYCA branding.

---

## Open Questions (blocking M1)

See the chat — these need answers before scaffolding starts.
