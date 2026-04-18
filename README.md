# SYCA AI

Personal branding chat SaaS for Start Your Content Academy (startyourcontentacademy.com).
See `CLAUDE.md` for the architecture and build plan.

## Local dev

```bash
cp .env.example .env.local   # fill in Supabase + Anthropic keys
npm install
npm run dev
```

Apply the SQL in `supabase/migrations/0001_init.sql` to your Supabase project before first sign-in. See `supabase/README.md`.
