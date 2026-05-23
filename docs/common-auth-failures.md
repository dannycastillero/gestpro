# Common Auth Failures — TecnoTrack

A record of every auth issue encountered and how it was solved.
Before making auth changes, read this file.

---

## Failure #1 — TypeScript Build Failure (cookiesToSet)

**Symptom:**
```
Type error: Parameter 'cookiesToSet' implicitly has an 'any' type.
  setAll(cookiesToSet) {
```

**Cause:**
TypeScript strict mode requires explicit types on all parameters.
`cookiesToSet` in the Supabase SSR cookie handler had no type annotation.

**Fix:**
```typescript
setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
```

**File:** `src/lib/supabase-server.ts`

**Status:** ✅ Fixed — do not revert.

---

## Failure #2 — NULL usernames causing login failure

**Symptom:**
User exists in Supabase Auth and in `perfiles`, but login always returns
"Usuario no encontrado".

**Cause:**
The `username` column was added via migration but existing rows had
`NULL` values. The login query `WHERE username = $1` never matched.

**Fix:**
```sql
-- Run in Supabase SQL Editor
UPDATE perfiles SET username = LOWER(TRIM(email)) WHERE username IS NULL;

-- Then add constraint to prevent future NULLs
ALTER TABLE perfiles ALTER COLUMN username SET NOT NULL;
```

Then update the user's username to the desired value in Table Editor.

**Status:** ✅ Fixed — constraint now enforces NOT NULL.

---

## Failure #3 — RLS blocked anon lookup during login

**Symptom:**
Login page returns "Usuario no encontrado" for all users, even valid ones.
The Supabase query returns `null` or `error: RLS violation`.

**Cause:**
The `perfiles` table only had policies for `authenticated` role.
The username lookup happens **before** the user is authenticated,
so it runs as `anon`. Without an `anon SELECT` policy, the query
returns nothing.

**Fix:**
```sql
CREATE POLICY "perfiles_anon_select" ON public.perfiles
  FOR SELECT TO anon USING (true);
```

**Warning:** This is intentional. The `perfiles` table contains only
non-sensitive data (name, username, role). Email is not exposed.

**Status:** ✅ Fixed — policy must remain in schema.

---

## Failure #4 — Middleware redirect loop

**Symptom:**
After login, browser shows "Too many redirects" or infinite spinner.
Console shows repeated 307 redirects between `/dashboard` and `/auth/login`.

**Cause:**
Middleware was returning `NextResponse.next()` instead of the
`supabaseResponse` that had updated session cookies. On the next
request, the session cookie was missing so the user appeared logged out,
triggering another redirect to login.

**Fix:**
```typescript
// middleware.ts — ALWAYS return supabaseResponse, never NextResponse.next()
export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createMiddlewareClient(request)
  await supabase.auth.getUser()  // refreshes cookies into supabaseResponse
  // ...
  return supabaseResponse  // ← this carries the updated cookies
}
```

**Status:** ✅ Fixed — never return `NextResponse.next()` from middleware.

---

## Failure #5 — "Auth session missing" with valid cookies

**Symptom:**
User is logged in (cookie exists in browser), but server components
throw `Auth session missing` or redirect to login on every page load.

**Cause:**
Old versions of `@supabase/ssr` (< 0.4.x) had a bug where cookies
set by the middleware were not correctly parsed by the server client.
This caused the server to see no session even though the browser had one.

**Fix:**
Keep `@supabase/ssr` at the locked version in `package.json`.
```json
"@supabase/ssr": "0.5.2"
```
Never use `^` (caret) on this dependency — it allows silent minor
version upgrades that can reintroduce this bug.

**Status:** ✅ Fixed — version is locked in package.json.

---

## Failure #6 — Font build error (Geist)

**Symptom:**
```
next/font error: Unknown font `Geist`
```

**Cause:**
`Geist` font was not available in Next.js 14.2.5 via `next/font/google`.

**Fix:**
Replace with `Inter` which is always available:
```typescript
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })
```

**File:** `src/app/layout.tsx`

**Status:** ✅ Fixed.

---

## Failure #7 — next/headers in client bundle

**Symptom:**
```
Error: You're importing a component that needs next/headers.
That only works in a Server Component.
```

**Cause:**
`supabase.ts` imported `cookies` from `next/headers`, which is a
server-only API. When a client component imported `supabase.ts`,
Next.js threw this error.

**Fix:**
Split into two files:
- `supabase.ts` — browser client only, no `next/headers`
- `supabase-server.ts` — server client, imports `next/headers`

**Status:** ✅ Fixed — never merge these two files back.

---

## Quick Diagnosis Checklist

If login breaks, check in this order:

1. **"Usuario no encontrado"** → check `perfiles.username` is not NULL,
   check anon SELECT policy exists on `perfiles`
2. **"Contraseña incorrecta"** → verify user exists in Supabase Auth
   (Authentication → Users)
3. **Redirect loop** → middleware returning wrong response object
4. **"Auth session missing"** → check `@supabase/ssr` version, check
   `supabase-server.ts` is used in server components only
5. **TypeScript build fail** → check `cookiesToSet` has explicit type
6. **Vercel build fail** → run `npm run build` locally first
