-- ============================================================
-- MIGRACIÓN v1.1 — Ejecutar en Supabase SQL Editor
-- Agrega: tabla tareas (WBS) + columna username en perfiles
-- ============================================================

-- 1. Agregar columna username a perfiles (si no existe)
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS perfiles_username_unique
  ON public.perfiles (username)
  WHERE username IS NOT NULL;

-- 2. Tabla de tareas (WBS / Work Breakdown Structure)
CREATE TABLE IF NOT EXISTS public.tareas (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  proyecto_id     UUID REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  padre_id        UUID REFERENCES public.tareas(id) ON DELETE SET NULL,
  fase            TEXT,                          -- phase/group label
  nombre          TEXT NOT NULL,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE NOT NULL,
  duracion        INTEGER DEFAULT 1,             -- days, auto-calculated
  responsable_id  UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  estado          TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (estado IN ('not_started', 'in_progress', 'completed', 'delayed')),
  porcentaje      INTEGER DEFAULT 0 CHECK (porcentaje >= 0 AND porcentaje <= 100),
  orden           INTEGER DEFAULT 1,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tareas_proyecto ON public.tareas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_tareas_padre ON public.tareas(padre_id);

-- 3. RLS for tareas
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view tasks
CREATE POLICY "tareas_select" ON public.tareas
  FOR SELECT TO authenticated USING (true);

-- Admin, implementador, arquitecto can create/edit tasks
CREATE POLICY "tareas_insert" ON public.tareas
  FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero', 'tecnico'));

CREATE POLICY "tareas_update" ON public.tareas
  FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero', 'tecnico'));

CREATE POLICY "tareas_delete" ON public.tareas
  FOR DELETE TO authenticated
  USING (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero'));

-- ✅ Done. Run this entire file in Supabase SQL Editor.
