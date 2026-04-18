# SYCA AI — Personal Branding Chat SaaS

A Claude-style chat app for **startyourcontentacademy.com**. Invited members sign in, chat with Claude, work inside shared Projects with uploaded reference files, and pick which model answers (Haiku 4.5 / Sonnet 4.5 / Sonnet 4.6 / Opus 4.6). Admins curate Skills and a shared Reference Folder that power every project.

Think: a Claude.ai clone with SYCA branding, invite-only login, and an admin panel for skills/reference.

Product name in UI: **SYCA AI**. Default styling for now; brand assets later.

---

## Tech Stack

| Layer        | Choice                                                            |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | Next.js 15 (App Router) on Vercel, React 19, Tailwind, shadcn/ui  |
| Auth         | Supabase Auth — **email + password only, invite-only**            |
| Database     | Supabase Postgres (RLS on every table)                            |
| File storage | Supabase Storage + Anthropic Files API (beta) for Claude context  |
| LLM          | `@anthropic-ai/sdk` — Messages API with streaming                 |
| Hosting      | Vercel (Edge for auth middleware, Node for `/api/chat` streaming) |

**Why Anthropic SDK, not Agent SDK:** Agent SDK is built for autonomous CLI agents with filesystem-based skills. We need cloud-hosted, DB-stored skills and full control over the chat loop — the Messages API fits directly.

**API key model:** single shared `ANTHROPIC_API_KEY` owned by SYCA. Members do not bring their own key. Cost is absorbed by SYCA. No per-user rate limiting / billing in v1.

---

## Models

Exposed in a model-picker dropdown, stored per-conversation:

| Label            | Model ID                      |
| ---------------- | ----------------------------- |
| Haiku 4.5        | `claude-haiku-4-5-20251001`   |
| Sonnet 4.5       | `claude-sonnet-4-5-20250929`  |
| Sonnet 4.6       | `claude-sonnet-4-6`           |
| Opus 4.6         | `claude-opus-4-6`             |

Default: Sonnet 4.6. Admin can change the global default from the settings panel.

---

## Auth & Roles

- **Email + password only.** No Google OAuth in v1.
- **Invite-only.** Public signup is disabled. Admin invites users via Supabase Auth admin API (server-side `supabase.auth.admin.inviteUserByEmail`). Invited user receives magic link, sets password, then uses password for subsequent logins.
- **Admin role:** hardcoded via env var `ADMIN_EMAILS` (comma-separated). When a profile's email matches, `profiles.role` is set to `admin` on first login. Middleware + RLS gate `/admin` routes and skill/reference writes.

---

## Core Features

1. **Auth** — Supabase email/password, invite-only. Session cookies, middleware-protected routes.
2. **Chat** — Streaming responses (SSE), markdown rendering, code blocks, copy/regenerate.
3. **Projects (shared org-wide)** — All members see all projects. Any member can create a project. Each project has its own reference files and optional system prompt. Conversations live under a project and stay private to each user.
4. **Project files** — Members upload files into a project. Supported: **PDF, txt, md, csv, docx, png, jpg, webp**. `.docx` is converted to text server-side before upload to Claude; other types pass through to the Files API directly. Files are stored in Supabase Storage AND uploaded to Anthropic Files API; `file_id` is attached to every message in that project.
5. **Admin panel** (`/admin`, admin role only)
   - **Skills** — admin **uploads a `.md` file** with YAML frontmatter (`name`, `description`) and markdown body. The file is forwarded to the **Anthropic Skills API**; Anthropic hosts the body and returns a `skill_id`. Every chat request attaches enabled `skill_id`s in `container.skills`. **Claude auto-picks** which skill(s) to activate per user message based on their descriptions.
   - **Reference folder** — global files available inside every project, merged with project files.
   - **Default model** and per-user usage overview.
6. **Model picker** — per-conversation, with the admin's default.
7. **Prompt caching** — system prompt + skills + reference files + project files are marked `cache_control: { type: "ephemeral" }` so repeat messages in a conversation cost ~10% of the first.

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

-- projects: shared across all members
create table projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id) on delete set null,
  name text not null,
  system_prompt text,
  created_at timestamptz default now()
);

-- project_files: shared (visible to all members because projects are shared)
create table project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  storage_path text not null,            -- supabase storage key
  anthropic_file_id text,                -- files API id (null until processed)
  filename text not null,
  mime_type text,
  size_bytes int,
  created_at timestamptz default now()
);

-- conversations: private to each user, scoped to a project
create table conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  title text,
  model text not null default 'claude-sonnet-4-6',
  created_at timestamptz default now()
);

-- messages: private via conversation ownership
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content jsonb not null,                -- content blocks
  input_tokens int, output_tokens int,
  cache_creation_tokens int, cache_read_tokens int,
  created_at timestamptz default now()
);

-- admin-managed skills; body is hosted by Anthropic Skills API
create table skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,             -- from frontmatter
  description text not null,             -- from frontmatter, shown to Claude for routing
  anthropic_skill_id text not null,      -- returned by Skills API on upload
  version text not null default 'latest',
  storage_path text not null,            -- raw .md backup in supabase storage
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- admin-managed reference folder
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

### RLS summary

| Table            | Read                                  | Write                                          |
| ---------------- | ------------------------------------- | ---------------------------------------------- |
| `profiles`       | self + admins read all                | self updates self; admins can update role      |
| `projects`       | any authenticated member              | any authenticated member can create / edit     |
| `project_files`  | any authenticated member              | any authenticated member                       |
| `conversations`  | `owner_id = auth.uid()`               | `owner_id = auth.uid()`                        |
| `messages`       | via conversation ownership            | via conversation ownership (inserts only)      |
| `skills`         | any authenticated member (read only)  | admins only                                    |
| `reference_files`| any authenticated member (read only)  | admins only                                    |
| `app_settings`   | any authenticated member              | admins only                                    |

---

## Directory Layout

```
syca/
├─ app/
│  ├─ (auth)/login/               # no /signup route — invite-only
│  ├─ (app)/
│  │  ├─ chat/[conversationId]/
│  │  ├─ projects/                # list all (shared) projects
│  │  ├─ projects/[projectId]/    # project detail + files + conversations
│  │  └─ layout.tsx               # sidebar w/ projects + user's conversations
│  ├─ admin/
│  │  ├─ skills/                  # upload / toggle / delete .md skills
│  │  ├─ reference/               # upload / toggle / delete reference files
│  │  ├─ invites/                 # invite new members by email
│  │  └─ settings/                # default model, usage stats
│  └─ api/
│     ├─ chat/route.ts            # SSE streaming
│     ├─ files/upload/route.ts    # project file upload
│     └─ admin/…
├─ lib/
│  ├─ anthropic.ts                # SDK client + buildSystemPrompt()
│  ├─ supabase/{server,client,middleware}.ts
│  ├─ models.ts                   # MODEL_IDS + DEFAULT_MODEL
│  ├─ skills.ts                   # parse .md frontmatter, load enabled skills
│  └─ files.ts                    # docx→text, upload to Anthropic Files API
├─ components/ui/…
├─ middleware.ts                  # auth + admin gate
└─ supabase/migrations/0001_init.sql
```

---

## Chat Request Flow

1. Client POSTs `{ conversationId, userMessage }` to `/api/chat`.
2. Server loads: conversation (for model + project), project files, enabled skill IDs, enabled reference files, prior messages.
3. Build request with beta headers `skills-2025-10-02` + `code-execution-2025-08-25`:
   - `system` array (all with `cache_control: { type: "ephemeral" }`):
     - base SYCA instructions
     - reference files as `document` blocks with `file_id`
     - project files as `document` blocks with `file_id`
     - project `system_prompt` if set
   - `container.skills`: array of `{ type: "custom", skill_id, version: "latest" }` for every enabled skill (cap 8 per request; if >8, admin picks priority).
   - `tools`: `[{ type: "code_execution_20250825", name: "code_execution" }]` — required by Skills API but only spins up the container if a skill calls for code.
4. `anthropic.beta.messages.stream({...})` → SSE to client. Claude chooses per-turn which of the attached skills to activate based on their descriptions.
5. On stream end: persist assistant message + token counts (including `cache_creation_input_tokens` / `cache_read_input_tokens`).

**Fallback if native Skills become a blocker:** swap `container.skills` for system-prompt concatenation (old Path B). Schema already stores `storage_path` so we retain the raw `.md`.

---

## Skill Upload Format

Admins upload a `.md` file. Example:

```markdown
---
name: hook-writer
description: Writes scroll-stopping short-form video hooks in SYCA's voice. Use when the user asks for hooks, openers, or the first 3 seconds of a video.
---

You are SYCA's hook specialist. Write 5 variations...
```

Server flow on upload:
1. Store raw `.md` in Supabase Storage (backup / re-upload source).
2. POST the file to Anthropic's **Skills API** (`/v1/skills`, beta header `skills-2025-10-02`).
3. Persist `{ name, description, anthropic_skill_id, version, storage_path }` in the `skills` table.

**Important:** the `description` is what Claude uses to decide whether to activate the skill for a given user message. Write it as "use when…" so the router has clear signals.

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=           # server only, for admin invites + storage
ANTHROPIC_API_KEY=                   # server only, single shared SYCA key
ADMIN_EMAILS=                        # comma-separated list
```

Supabase project will be created later; `.env.local` stays empty until then.

---

## Build Milestones

- **M1** — Scaffold Next.js, Supabase client helpers, login page, middleware auth gate, profiles table + first-login hook that applies admin role from `ADMIN_EMAILS`.
- **M2** — Shared projects + conversations CRUD, basic chat (no files, default model).
- **M3** — Model picker + streaming + markdown rendering + message persistence.
- **M4** — Project file upload: Supabase Storage → Anthropic Files API, wired into `/api/chat`. Support PDF / txt / md / csv / images natively; convert `.docx` server-side.
- **M5** — Admin panel: `.md` skill uploads (forwarded to Anthropic Skills API → store `skill_id`), reference folder uploads, default model, invite-by-email. Wire `container.skills` + `code_execution` tool into `/api/chat` so Claude auto-picks skills per message.
- **M6** — Prompt caching, token usage display, SYCA branding polish.

Stretch (out of scope for v1): per-user rate limits, monthly token caps, Stripe billing, Google OAuth, regenerate/edit message history.
