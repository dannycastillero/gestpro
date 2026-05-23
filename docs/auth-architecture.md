# Auth Architecture — TecnoTrack

## Overview

TecnoTrack uses **username-based authentication** layered on top of
Supabase email/password auth. Users never type an email — only a username.

---

## 1. Login Flow

```
User enters: username + password
       │
       ▼
Normalize: username.trim().toLowerCase()
       │
       ▼
Query: SELECT email, activo FROM perfiles WHERE username = $1
       │
       ├─ NOT FOUND → "Usuario no encontrado"
       ├─ activo = false → "Cuenta desactivada"
       │
       ▼
supabase.auth.signInWithPassword({ email, password })
       │
       ├─ ERROR → show message (never expose raw Supabase error)
       │
       ▼
router.push('/dashboard') + router.refresh()
```

**Key rule:** The `perfiles` table must allow **anon SELECT** so the
username lookup works before the user is authenticated.

---

## 2. Middleware Flow

File: `middleware.ts`

```
Every request (except /auth/* and static assets)
       │
       ▼
createMiddlewareClient(request)
  → creates mutable supabaseResponse reference
       │
       ▼
supabase.auth.getUser()
  → refreshes session cookie if needed
  → MUST use the SAME supabaseResponse that cookies were set on
       │
       ├─ No user + path !== /auth → redirect to /auth/login
       ├─ User + path === /auth    → redirect to /dashboard
       ├─ path startsWith /usuarios → check rol = 'administrador'
       │
       ▼
return supabaseResponse  ← ALWAYS return this, never NextResponse.next()
```

**Critical:** Never destructure `supabaseResponse` before cookies are
set. The reference must remain mutable throughout the middleware function.

---

## 3. Session Refresh Flow

Supabase SSR auto-refreshes the JWT before it expires.

- `createServerClient` (in `supabase-server.ts`) reads cookies from
  `next/headers` on every server render.
- `createMiddlewareClient` (in `supabase.ts`) intercepts the response
  to set refreshed cookies back on the browser.
- Both must use `@supabase/ssr` at the **locked version** in package.json.

---

## 4. SSR Handling

Two separate Supabase clients exist intentionally:

| File | Used in | Can use next/headers? |
|------|---------|----------------------|
| `src/lib/supabase.ts` | Client components (`'use client'`), middleware | ❌ No |
| `src/lib/supabase-server.ts` | Server components, layouts, page.tsx files | ✅ Yes |

**Never import `supabase-server.ts` from a client component.**
**Never import `supabase.ts` (browser client) in a server layout.**

---

## 5. RLS Requirements

```sql
-- perfiles must allow anon SELECT for username login lookup
-- This policy MUST exist:
CREATE POLICY "perfiles_anon_select" ON public.perfiles
  FOR SELECT TO anon USING (true);

-- Authenticated users also need SELECT:
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT TO authenticated USING (true);
```

If either of these is removed, the login will fail silently with
"Usuario no encontrado" even when the username exists.

---

## 6. Username Lookup Logic

```typescript
// Always normalize before querying
const normalized = username.trim().toLowerCase()

const { data: perfil } = await supabase
  .from('perfiles')
  .select('email, activo')
  .eq('username', normalized)
  .single()
```

- Usernames are stored lowercase in the database.
- The DB has a normalization trigger that enforces this on INSERT/UPDATE.
- The unique index is on the lowercase value.

---

## 7. Cookie Typing Requirements

All cookie handler parameters must be explicitly typed to pass
TypeScript strict mode:

```typescript
// ✅ CORRECT
setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {

// ❌ WRONG — causes TypeScript build failure
setAll(cookiesToSet) {
```

---

## 8. Files That Touch Auth

| File | Role | Risk if modified |
|------|------|-----------------|
| `middleware.ts` | Route protection, session refresh | HIGH — redirect loops |
| `src/lib/supabase.ts` | Browser + middleware client | HIGH — breaks SSR |
| `src/lib/supabase-server.ts` | Server component client | HIGH — breaks layouts |
| `src/app/auth/login/page.tsx` | Username login UI | MEDIUM |
| `supabase_schema.sql` | RLS policies | HIGH — blocks login |
| `migration_v1_1.sql` | DB constraints | MEDIUM |
