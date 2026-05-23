-- ============================================================
-- MIGRACIÓN v1.3 — Ejecutar en Supabase SQL Editor
-- Agrega columna 'tipo' a la tabla tareas
-- Run AFTER migration_v1_1.sql and migration_v1_2.sql
-- ============================================================

-- 1. Add tipo column to tareas
ALTER TABLE public.tareas
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'task'
  CHECK (tipo IN ('task', 'group', 'subtask'));

-- 2. Backfill existing rows
-- Rows with padre_id = subtask, rows without = task
UPDATE public.tareas SET tipo = 'subtask' WHERE padre_id IS NOT NULL;
UPDATE public.tareas SET tipo = 'task' WHERE padre_id IS NULL;

-- ✅ Done.
