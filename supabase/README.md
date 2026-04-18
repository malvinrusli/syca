# Supabase Setup

1. Create a new project at <https://supabase.com>.
2. Copy project URL, anon key, and service role key into `.env.local`.
3. Run the SQL in `migrations/0001_init.sql` against your project (SQL editor or CLI).
4. In **Authentication → Providers**, disable sign-ups. Enable only email/password.
5. In **Authentication → URL Configuration**, set:
   - Site URL: `https://<your-vercel-domain>` (or `http://localhost:3000` locally)
   - Redirect URLs: `<site>/auth/callback`
6. Add admins by putting their emails in `ADMIN_EMAILS` (comma-separated). Roles are synced automatically on first sign-in via `POST /api/auth/sync`.
7. Invite members from `/admin/invites` (added in M5).
