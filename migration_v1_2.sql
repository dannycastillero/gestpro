-- ============================================================
-- MIGRACIÓN v1.2 — Ejecutar en Supabase SQL Editor
-- Agrega: anon SELECT policy, NOT NULL en username,
--         normalization trigger, unique constraint
-- ============================================================

-- 1. Anon SELECT policy on perfiles (REQUIRED for username login)
-- The login page queries perfiles BEFORE the user is authenticated.
-- Without this, the username lookup fails for everyone.
DROP POLICY IF EXISTS "perfiles_anon_select" ON public.perfiles;
CREATE POLICY "perfiles_anon_select" ON public.perfiles
  FOR SELECT TO anon USING (true);

-- 2. Normalize all existing usernames to lowercase/trimmed
UPDATE public.perfiles
  SET username = LOWER(TRIM(username))
  WHERE username IS NOT NULL;

-- 3. NOT NULL constraint on username
-- Every user must have a username to be able to log in.
ALTER TABLE public.perfiles
  ALTER COLUMN username SET NOT NULL;

-- 4. Unique constraint on username (in addition to the partial index)
ALTER TABLE public.perfiles
  DROP CONSTRAINT IF EXISTS unique_username;
ALTER TABLE public.perfiles
  ADD CONSTRAINT unique_username UNIQUE (username);

-- 5. Normalization trigger — enforce lowercase on every INSERT/UPDATE
CREATE OR REPLACE FUNCTION normalize_username()
RETURNS TRIGGER AS $$
BEGIN
  NEW.username = LOWER(TRIM(NEW.username));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_normalize_username ON public.perfiles;
CREATE TRIGGER tg_normalize_username
  BEFORE INSERT OR UPDATE OF username ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION normalize_username();

-- ============================================================
-- IMPORTANT: Before running this migration, make sure ALL
-- existing rows in perfiles have a username value.
-- Run this first to check:
--   SELECT id, nombre, email, username FROM perfiles WHERE username IS NULL;
-- If any rows have NULL username, set them manually in Table Editor
-- or run:
--   UPDATE perfiles SET username = LOWER(SPLIT_PART(email, '@', 1))
--   WHERE username IS NULL;
-- ============================================================
