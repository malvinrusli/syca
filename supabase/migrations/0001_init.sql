-- SYCA AI initial schema
-- Tables, RLS, and storage buckets for M1 through M5.

-- ========== profiles ==========
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_self_read"
  on profiles for select
  using (auth.uid() = id or exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "profiles_self_update"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profiles are inserted via /api/auth/sync using the user's session; RLS must allow self-insert.
create policy "profiles_self_insert"
  on profiles for insert
  with check (auth.uid() = id);

-- ========== projects (shared org-wide) ==========
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  name text not null,
  system_prompt text,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;

create policy "projects_member_read"
  on projects for select to authenticated using (true);

create policy "projects_member_write"
  on projects for insert to authenticated with check (auth.uid() = created_by);

create policy "projects_member_update"
  on projects for update to authenticated using (true) with check (true);

create policy "projects_member_delete"
  on projects for delete to authenticated using (true);

-- ========== project_files ==========
create table if not exists project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  storage_path text not null,
  anthropic_file_id text,
  filename text not null,
  mime_type text,
  size_bytes int,
  created_at timestamptz not null default now()
);

alter table project_files enable row level security;

create policy "project_files_member_read"
  on project_files for select to authenticated using (true);

create policy "project_files_member_write"
  on project_files for insert to authenticated with check (true);

create policy "project_files_member_delete"
  on project_files for delete to authenticated using (true);

-- ========== conversations (private per user) ==========
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  title text,
  model text not null default 'claude-sonnet-4-6',
  created_at timestamptz not null default now()
);

alter table conversations enable row level security;

create policy "conversations_owner_all"
  on conversations for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ========== messages ==========
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content jsonb not null,
  input_tokens int,
  output_tokens int,
  cache_creation_tokens int,
  cache_read_tokens int,
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "messages_owner_read"
  on messages for select to authenticated
  using (exists (
    select 1 from conversations c where c.id = conversation_id and c.owner_id = auth.uid()
  ));

create policy "messages_owner_insert"
  on messages for insert to authenticated
  with check (exists (
    select 1 from conversations c where c.id = conversation_id and c.owner_id = auth.uid()
  ));

-- ========== skills (admin-managed) ==========
create table if not exists skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  anthropic_skill_id text not null,
  version text not null default 'latest',
  storage_path text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table skills enable row level security;

create policy "skills_member_read"
  on skills for select to authenticated using (true);

create policy "skills_admin_write"
  on skills for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ========== reference_files (admin-managed) ==========
create table if not exists reference_files (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  anthropic_file_id text,
  filename text not null,
  mime_type text,
  size_bytes int,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table reference_files enable row level security;

create policy "reference_member_read"
  on reference_files for select to authenticated using (true);

create policy "reference_admin_write"
  on reference_files for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ========== app_settings ==========
create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

alter table app_settings enable row level security;

create policy "settings_member_read"
  on app_settings for select to authenticated using (true);

create policy "settings_admin_write"
  on app_settings for all to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into app_settings (key, value) values ('default_model', '"claude-sonnet-4-6"'::jsonb)
on conflict (key) do nothing;

-- ========== Storage buckets ==========
-- project-files: shared across members (projects are org-wide).
-- reference-files: shared across members (read), admin-only write.
-- skills: raw .md backups, admin-only.
insert into storage.buckets (id, name, public)
values
  ('project-files', 'project-files', false),
  ('reference-files', 'reference-files', false),
  ('skills', 'skills', false)
on conflict (id) do nothing;

create policy "project_files_storage_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'project-files');

create policy "project_files_storage_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files');

create policy "project_files_storage_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-files');

create policy "reference_storage_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'reference-files');

create policy "reference_storage_admin_write"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'reference-files'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    bucket_id = 'reference-files'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "skills_storage_admin_all"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'skills'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    bucket_id = 'skills'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
