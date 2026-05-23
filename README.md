# TecnoTrack

**SaaS de Documentación y Seguimiento de Proyectos**
Exclusivo para uso interno de ITCOMSA / TECNOAMBIENTES

Developed by TecnoSupplies 2026 · All Rights Reserved

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (SSR) |
| Storage | Supabase Storage |
| Hosting (demo) | Vercel |
| Hosting (prod) | Bluehost VPS + Nginx + PM2 |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Run database migrations
# Execute supabase_schema.sql in Supabase SQL Editor
# Execute migration_v1_1.sql in Supabase SQL Editor

# 4. Run development server
npm run dev
```

---

## Project Structure

```
src/
├── app/
│   ├── (app)/              # Protected routes (require login)
│   │   ├── dashboard/      # Main dashboard + costs panel
│   │   ├── clientes/       # Client CRM
│   │   ├── proyectos/      # Projects + WBS tasks
│   │   └── usuarios/       # User management (admin only)
│   └── auth/login/         # Login page (username-based)
├── components/
│   ├── layout/Sidebar.tsx
│   ├── proyectos/ProyectoTabs.tsx
│   ├── proyectos/TabWBS.tsx
│   └── usuarios/GestionUsuariosClient.tsx
├── lib/
│   ├── supabase.ts         # Browser client (client components + middleware)
│   └── supabase-server.ts  # Server client (server components only)
├── types/index.ts
docs/
├── auth-architecture.md    # Full auth flow documentation
└── common-auth-failures.md # Known issues and fixes
middleware.ts               # Route protection + session refresh
supabase_schema.sql         # Full database schema
migration_v1_1.sql          # v1.1 migration (tasks + username)
```

---

## User Roles

| Role | Access |
|------|--------|
| `administrador` | Full access + user management |
| `arquitecto_ingeniero` | Projects, clients, costs (read) |
| `implementador` | Projects, clients, tasks |
| `tecnico` | Bitácora entries, tasks |
| `contabilidad` | Costs (edit), financial dashboard |

---

## Critical Authentication Rules

This project uses **username-based authentication** layered on top of
Supabase email/password auth.

The login flow is:
1. User enters username
2. App normalizes: `username.trim().toLowerCase()`
3. Queries `perfiles` table by username (requires anon SELECT policy)
4. Retrieves associated email
5. Authenticates with Supabase using email + password
6. Middleware refreshes session cookies
7. User reaches dashboard

### DO NOT:
- Remove the username lookup flow from `src/app/auth/login/page.tsx`
- Switch to email-only login
- Remove the anon SELECT policy on `perfiles`
- Downgrade `@supabase/ssr` (version is intentionally locked)
- Import `supabase-server.ts` from client components
- Import `supabase.ts` (browser client) in server layouts
- Return `NextResponse.next()` from middleware (use `supabaseResponse`)
- Remove explicit types from cookie handler parameters
- Merge `supabase.ts` and `supabase-server.ts` back into one file

### Before modifying any auth file:
Read `docs/auth-architecture.md` and `docs/common-auth-failures.md`

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Deployment

### Demo (Vercel + Supabase Cloud)
Push to GitHub → Vercel auto-deploys.

### Production (Bluehost VPS)
See `docs/auth-architecture.md` and the PRD document for full
VPS migration guide.

---

## Database Migrations

Run in order in Supabase SQL Editor:

1. `supabase_schema.sql` — initial schema
2. `migration_v1_1.sql` — tasks (WBS) + username column

---

## Known Issues Log

See `docs/common-auth-failures.md` for a full record of every
auth issue encountered and resolved.
