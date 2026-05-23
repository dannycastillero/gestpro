'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, Save, Trash2, ChevronRight, ChevronDown,
  GanttChartSquare, Pencil, X, Check, FolderOpen,
  ListTodo, GitBranch, AlertCircle
} from 'lucide-react'
import { format, differenceInDays, parseISO, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Perfil, EstadoTarea,
  ESTADO_TAREA_LABELS, ESTADO_TAREA_COLORS, ESTADO_TAREA_BAR
} from '@/types'
import clsx from 'clsx'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type TipoTarea = 'task' | 'group' | 'subtask'

interface Tarea {
  id: string
  proyecto_id: string
  padre_id: string | null
  tipo: TipoTarea
  nombre: string
  estado: EstadoTarea
  porcentaje: number
  responsable_id: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  duracion: number
  orden: number
  creado_en: string
  responsable?: { id: string; nombre: string } | null
}

interface Props {
  proyectoId: string
  perfil: Perfil | null
  puedeEditar: boolean
}

// ─────────────────────────────────────────────────────────────
// Group colors (cycle through these for visual variety)
// ─────────────────────────────────────────────────────────────
const GROUP_COLORS = [
  { bar: 'bg-blue-500',   light: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700',  icon: 'text-blue-500'   },
  { bar: 'bg-emerald-500',light: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700',icon: 'text-emerald-500'},
  { bar: 'bg-violet-500', light: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700', icon: 'text-violet-500' },
  { bar: 'bg-orange-500', light: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-700', icon: 'text-orange-500' },
  { bar: 'bg-rose-500',   light: 'bg-rose-50',    border: 'border-rose-200',   text: 'text-rose-700',   icon: 'text-rose-500'   },
  { bar: 'bg-cyan-500',   light: 'bg-cyan-50',    border: 'border-cyan-200',   text: 'text-cyan-700',   icon: 'text-cyan-500'   },
]

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function autoStatus(pct: number): EstadoTarea {
  if (pct === 0) return 'not_started'
  if (pct === 100) return 'completed'
  return 'in_progress'
}

function calcDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0
  try { return Math.max(1, differenceInDays(parseISO(end), parseISO(start)) + 1) }
  catch { return 0 }
}

// Normalize tipo — handle rows that existed before the tipo column was added
function normalizeTipo(t: any): TipoTarea {
  if (t.tipo === 'group' || t.tipo === 'subtask' || t.tipo === 'task') return t.tipo
  // Fallback: if has padre_id → subtask, else task
  return t.padre_id ? 'subtask' : 'task'
}

const INP = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function TabWBS({ proyectoId, perfil, puedeEditar }: Props) {
  const supabase = createClient()
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'gantt'>('list')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Create form state
  const [cf, setCf] = useState({
    nombre: '', tipo: 'task' as TipoTarea, padre_id: '',
    fecha_inicio: '', fecha_fin: '', responsable_id: '',
  })

  // Edit form state
  const [ef, setEf] = useState({
    nombre: '', tipo: 'task' as TipoTarea, padre_id: '',
    fecha_inicio: '', fecha_fin: '', responsable_id: '',
    estado: 'not_started' as EstadoTarea, porcentaje: 0,
  })

  // ── Load ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setError(null)
    try {
      const [{ data: t, error: te }, { data: u }] = await Promise.all([
        supabase
          .from('tareas')
          .select('*, responsable:perfiles!responsable_id(id, nombre)')
          .eq('proyecto_id', proyectoId)
          .order('orden', { ascending: true })
          .order('creado_en', { ascending: true }),
        supabase
          .from('perfiles')
          .select('id, nombre, rol, email, activo, creado_en, actualizado_en')
          .eq('activo', true)
          .order('nombre'),
      ])
      if (te) { setError(`Error cargando tareas: ${te.message}`); return }
      // Normalize tipo for all rows
      const normalized = (t || []).map(row => ({ ...row, tipo: normalizeTipo(row) })) as Tarea[]
      setTareas(normalized)
      setUsuarios((u || []) as Perfil[])
    } catch (e: any) {
      setError(e.message || 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { load() }, [load])

  // ── Create ────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const maxOrden = tareas.length > 0 ? Math.max(...tareas.map(t => t.orden || 0)) + 1 : 1
    const { error: ie } = await supabase.from('tareas').insert({
      proyecto_id: proyectoId,
      nombre: cf.nombre.trim(),
      tipo: cf.tipo,
      padre_id: cf.tipo === 'subtask' && cf.padre_id ? cf.padre_id : null,
      fecha_inicio: cf.fecha_inicio || null,
      fecha_fin: cf.fecha_fin || null,
      duracion: calcDays(cf.fecha_inicio, cf.fecha_fin),
      responsable_id: cf.responsable_id || null,
      estado: 'not_started',
      porcentaje: 0,
      orden: maxOrden,
    })
    if (ie) { alert(`Error: ${ie.message}`); setSaving(false); return }
    setShowCreate(false)
    setCf({ nombre: '', tipo: 'task', padre_id: '', fecha_inicio: '', fecha_fin: '', responsable_id: '' })
    setSaving(false)
    await load()
  }

  // ── Start edit ───────────────────────────────────────────
  function startEdit(t: Tarea) {
    setShowCreate(false)
    setEditId(t.id)
    setEf({
      nombre: t.nombre,
      tipo: t.tipo,
      padre_id: t.padre_id || '',
      fecha_inicio: t.fecha_inicio || '',
      fecha_fin: t.fecha_fin || '',
      responsable_id: t.responsable_id || '',
      estado: t.estado,
      porcentaje: t.porcentaje,
    })
  }

  // ── Save edit ────────────────────────────────────────────
  async function saveEdit(t: Tarea) {
    setSaving(true)
    let pct = ef.porcentaje
    let estado: EstadoTarea = ef.estado
    if (t.tipo === 'group') {
      const subs = tareas.filter(s => s.padre_id === t.id)
      pct = subs.length > 0 ? Math.round(subs.reduce((s, x) => s + x.porcentaje, 0) / subs.length) : 0
      estado = autoStatus(pct)
    } else {
      estado = autoStatus(pct)
    }
    await supabase.from('tareas').update({
      nombre: ef.nombre.trim(),
      tipo: ef.tipo,
      padre_id: ef.tipo === 'subtask' && ef.padre_id ? ef.padre_id : null,
      fecha_inicio: ef.fecha_inicio || null,
      fecha_fin: ef.fecha_fin || null,
      duracion: calcDays(ef.fecha_inicio, ef.fecha_fin),
      responsable_id: ef.responsable_id || null,
      estado,
      porcentaje: pct,
    }).eq('id', t.id)
    setEditId(null)
    setSaving(false)
    await load()
  }

  // ── Update progress inline ───────────────────────────────
  async function updatePct(t: Tarea, pct: number) {
    const p = Math.min(100, Math.max(0, pct))
    await supabase.from('tareas').update({ porcentaje: p, estado: autoStatus(p) }).eq('id', t.id)
    if (t.padre_id) {
      const subs = tareas.filter(s => s.padre_id === t.padre_id)
      // Optimistic update for recalc
      const updated = subs.map(s => s.id === t.id ? { ...s, porcentaje: p } : s)
      const avg = Math.round(updated.reduce((a, s) => a + s.porcentaje, 0) / updated.length)
      await supabase.from('tareas').update({ porcentaje: avg, estado: autoStatus(avg) }).eq('id', t.padre_id)
    }
    await load()
  }

  // ── Delete ───────────────────────────────────────────────
  async function deleteTarea(t: Tarea) {
    const hasSubs = tareas.some(s => s.padre_id === t.id)
    const msg = hasSubs
      ? `"${t.nombre}" tiene subtareas. ¿Eliminar todo el grupo y sus subtareas?`
      : `¿Eliminar "${t.nombre}"?`
    if (!confirm(msg)) return
    if (hasSubs) {
      const subIds = tareas.filter(s => s.padre_id === t.id).map(s => s.id)
      await supabase.from('tareas').delete().in('id', subIds)
    }
    await supabase.from('tareas').delete().eq('id', t.id)
    await load()
  }

  // ── Derived ───────────────────────────────────────────────
  const groups    = tareas.filter(t => t.tipo === 'group')
  const standalones = tareas.filter(t => t.tipo === 'task' && !t.padre_id)
  const getChildren = (id: string) => tareas.filter(t => t.padre_id === id)

  // Color map for groups
  const groupColorMap: Record<string, typeof GROUP_COLORS[0]> = {}
  groups.forEach((g, i) => { groupColorMap[g.id] = GROUP_COLORS[i % GROUP_COLORS.length] })

  // Overall progress
  const leafTasks = tareas.filter(t => t.tipo !== 'group')
  const overallPct = leafTasks.length
    ? Math.round(leafTasks.reduce((s, t) => s + t.porcentaje, 0) / leafTasks.length)
    : 0

  // Gantt
  const allDates = tareas.flatMap(t => [t.fecha_inicio, t.fecha_fin]).filter(Boolean) as string[]
  const minDate = allDates.length ? allDates.reduce((a, b) => a < b ? a : b) : null
  const maxDate = allDates.length ? allDates.reduce((a, b) => a > b ? a : b) : null
  const ganttDays = minDate && maxDate
    ? (() => { try { return eachDayOfInterval({ start: parseISO(minDate), end: parseISO(maxDate) }) } catch { return [] } })()
    : []
  const ganttOff = (d: string | null) => {
    if (!minDate || !d) return 0
    try { return Math.max(0, differenceInDays(parseISO(d), parseISO(minDate))) } catch { return 0 }
  }

  // ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
      Cargando tareas...
    </div>
  )

  if (error) return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold">Error al cargar el módulo WBS</p>
        <p className="mt-1">{error}</p>
        <p className="mt-2 text-xs">Asegúrate de haber ejecutado migration_v1_3.sql en Supabase SQL Editor.</p>
        <button onClick={load} className="mt-2 text-red-600 underline text-xs">Reintentar</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['list','gantt'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1',
                  view === v ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {v === 'gantt' && <GanttChartSquare className="w-3.5 h-3.5" />}
                {v === 'list' ? 'Lista' : 'Gantt'}
              </button>
            ))}
          </div>
          {tareas.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${overallPct}%` }} />
              </div>
              <span className="text-xs text-gray-600 font-medium">{overallPct}% completado</span>
            </div>
          )}
        </div>
        {puedeEditar && (
          <button onClick={() => { setShowCreate(!showCreate); setEditId(null) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>
        )}
      </div>

      {/* ── Create form ─────────────────────────────────────── */}
      {showCreate && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-blue-900 text-sm">Nueva tarea</h4>
            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre *</label>
                <input className={INP} placeholder="Nombre de la tarea..."
                  value={cf.nombre} onChange={e => setCf(f => ({ ...f, nombre: e.target.value }))} required />
              </div>

              {/* Type selector */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-2">Tipo de tarea *</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { v: 'task' as TipoTarea,    label: 'Tarea',    sub: 'Independiente', Icon: ListTodo  },
                    { v: 'group' as TipoTarea,   label: 'Grupo',    sub: 'Contiene subtareas', Icon: FolderOpen },
                    { v: 'subtask' as TipoTarea, label: 'Subtarea', sub: 'Dentro de un grupo', Icon: GitBranch  },
                  ]).map(opt => (
                    <button key={opt.v} type="button"
                      onClick={() => setCf(f => ({ ...f, tipo: opt.v, padre_id: opt.v !== 'subtask' ? '' : f.padre_id }))}
                      className={clsx(
                        'flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-xs font-medium transition-all',
                        cf.tipo === opt.v
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                      )}>
                      <opt.Icon className="w-5 h-5" />
                      <span className="font-semibold">{opt.label}</span>
                      <span className={clsx('text-xs leading-tight text-center', cf.tipo === opt.v ? 'text-blue-100' : 'text-gray-400')}>
                        {opt.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Parent selector — subtask only */}
              {cf.tipo === 'subtask' && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Grupo padre *</label>
                  {groups.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⚠️ No hay grupos creados. Crea primero un Grupo para poder agregar subtareas.
                    </p>
                  ) : (
                    <select className={INP} value={cf.padre_id}
                      onChange={e => setCf(f => ({ ...f, padre_id: e.target.value }))} required>
                      <option value="">Seleccionar grupo...</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Dates */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha inicio *</label>
                <input type="date" className={INP}
                  value={cf.fecha_inicio} onChange={e => setCf(f => ({ ...f, fecha_inicio: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Fecha fin *</label>
                <input type="date" className={INP}
                  value={cf.fecha_fin} onChange={e => setCf(f => ({ ...f, fecha_fin: e.target.value }))} required />
              </div>

              {cf.fecha_inicio && cf.fecha_fin && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">
                    {calcDays(cf.fecha_inicio, cf.fecha_fin)} días
                  </span>
                </div>
              )}

              {/* Responsible */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Responsable</label>
                <select className={INP} value={cf.responsable_id}
                  onChange={e => setCf(f => ({ ...f, responsable_id: e.target.value }))}>
                  <option value="">Sin asignar</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 text-xs text-gray-400">
                <Check className="w-3.5 h-3.5 text-green-500" />
                Estado y progreso se actualizan después de crear la tarea.
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={saving || (cf.tipo === 'subtask' && groups.length === 0)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Crear tarea'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {tareas.length === 0 && !showCreate && (
        <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <GanttChartSquare className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500 text-base">Sin tareas registradas</p>
          <p className="text-sm mt-1 mb-4">Empieza creando un Grupo o una Tarea independiente</p>
          {puedeEditar && (
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Nueva tarea
            </button>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          LIST VIEW
      ════════════════════════════════════════════════════ */}
      {view === 'list' && tareas.length > 0 && (
        <div className="space-y-3">

          {/* GROUPS */}
          {groups.map((group, gi) => {
            const color = GROUP_COLORS[gi % GROUP_COLORS.length]
            const subs = getChildren(group.id)
            const groupPct = subs.length > 0
              ? Math.round(subs.reduce((s, t) => s + t.porcentaje, 0) / subs.length)
              : group.porcentaje
            const isOpen = collapsed[group.id] !== true

            return (
              <div key={group.id} className={clsx('rounded-xl border overflow-hidden shadow-sm', color.border)}>

                {/* Group header row */}
                <div className={clsx('flex items-center gap-2 px-4 py-3 border-b', color.light, color.border)}>
                  {/* Expand/collapse */}
                  <button onClick={() => setCollapsed(c => ({ ...c, [group.id]: !isOpen }))}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  <FolderOpen className={clsx('w-4 h-4 flex-shrink-0', color.icon)} />

                  {editId === group.id ? (
                    <input className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={ef.nombre} onChange={e => setEf(f => ({ ...f, nombre: e.target.value }))} />
                  ) : (
                    <span className={clsx('font-semibold text-sm flex-1', color.text)}>{group.nombre}</span>
                  )}

                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {subs.length} subtarea{subs.length !== 1 ? 's' : ''}
                  </span>

                  {/* Progress */}
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-white/70 rounded-full overflow-hidden hidden sm:block border border-gray-200">
                      <div className={clsx('h-full rounded-full transition-all', color.bar)}
                        style={{ width: `${groupPct}%` }} />
                    </div>
                    <span className={clsx('text-xs font-bold w-9 text-right', color.text)}>{groupPct}%</span>
                  </div>

                  {/* Edit/delete actions */}
                  {puedeEditar && (
                    <div className="flex items-center gap-1 ml-1">
                      {editId === group.id ? (
                        <>
                          <button onClick={() => saveEdit(group)} disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(group)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                            title="Editar grupo">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteTarea(group)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors"
                            title="Eliminar grupo">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit form for group (name only — progress is auto) */}
                {editId === group.id && (
                  <div className={clsx('px-4 py-3 border-b', color.light, color.border)}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fecha inicio</label>
                        <input type="date" className={INP + ' text-xs py-1.5'}
                          value={ef.fecha_inicio} onChange={e => setEf(f => ({ ...f, fecha_inicio: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Fecha fin</label>
                        <input type="date" className={INP + ' text-xs py-1.5'}
                          value={ef.fecha_fin} onChange={e => setEf(f => ({ ...f, fecha_fin: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Responsable</label>
                        <select className={INP + ' text-xs py-1.5'}
                          value={ef.responsable_id} onChange={e => setEf(f => ({ ...f, responsable_id: e.target.value }))}>
                          <option value="">Sin asignar</option>
                          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Check className="w-3 h-3 text-green-500" />
                      El progreso del grupo se calcula automáticamente desde sus subtareas.
                    </p>
                  </div>
                )}

                {/* Subtasks */}
                {isOpen && (
                  subs.length === 0 ? (
                    <div className="px-6 py-4 text-xs text-gray-400 italic bg-white">
                      Sin subtareas — crea una tarea de tipo "Subtarea" y selecciona este grupo como padre.
                    </div>
                  ) : (
                    <>
                      {/* Desktop */}
                      <table className="w-full text-sm hidden md:table bg-white">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 pl-10 w-64">Subtarea</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Inicio</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Fin</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Días</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Responsable</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Estado</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 w-48">Avance</th>
                            {puedeEditar && <th className="px-4 py-2 w-16"></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {subs.map(sub => (
                            editId === sub.id
                              ? <EditRow key={sub.id} tarea={sub} ef={ef} setEf={setEf} grupos={groups}
                                  usuarios={usuarios} onSave={() => saveEdit(sub)}
                                  onCancel={() => setEditId(null)} saving={saving} colSpan={puedeEditar ? 8 : 7} />
                              : <TaskRow key={sub.id} tarea={sub} isSubtask puedeEditar={puedeEditar}
                                  onEdit={() => startEdit(sub)} onDelete={() => deleteTarea(sub)}
                                  onUpdatePct={(p) => updatePct(sub, p)} />
                          ))}
                        </tbody>
                      </table>
                      {/* Mobile */}
                      <div className="md:hidden bg-white divide-y divide-gray-100">
                        {subs.map(sub => (
                          editId === sub.id
                            ? <EditCard key={sub.id} tarea={sub} ef={ef} setEf={setEf} grupos={groups}
                                usuarios={usuarios} onSave={() => saveEdit(sub)}
                                onCancel={() => setEditId(null)} saving={saving} />
                            : <TaskCard key={sub.id} tarea={sub} isSubtask puedeEditar={puedeEditar}
                                onEdit={() => startEdit(sub)} onDelete={() => deleteTarea(sub)}
                                onUpdatePct={(p) => updatePct(sub, p)} />
                        ))}
                      </div>
                    </>
                  )
                )}
              </div>
            )
          })}

          {/* STANDALONE TASKS */}
          {standalones.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Tareas independientes
                </span>
                <span className="text-xs text-gray-400">({standalones.length})</span>
              </div>
              {/* Desktop */}
              <table className="w-full text-sm hidden md:table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 w-64">Tarea</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Inicio</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Fin</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Días</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Responsable</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Estado</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 w-48">Avance</th>
                    {puedeEditar && <th className="px-4 py-2 w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {standalones.map(t => (
                    editId === t.id
                      ? <EditRow key={t.id} tarea={t} ef={ef} setEf={setEf} grupos={groups}
                          usuarios={usuarios} onSave={() => saveEdit(t)}
                          onCancel={() => setEditId(null)} saving={saving} colSpan={puedeEditar ? 8 : 7} />
                      : <TaskRow key={t.id} tarea={t} isSubtask={false} puedeEditar={puedeEditar}
                          onEdit={() => startEdit(t)} onDelete={() => deleteTarea(t)}
                          onUpdatePct={(p) => updatePct(t, p)} />
                  ))}
                </tbody>
              </table>
              {/* Mobile */}
              <div className="md:hidden divide-y divide-gray-100">
                {standalones.map(t => (
                  editId === t.id
                    ? <EditCard key={t.id} tarea={t} ef={ef} setEf={setEf} grupos={groups}
                        usuarios={usuarios} onSave={() => saveEdit(t)}
                        onCancel={() => setEditId(null)} saving={saving} />
                    : <TaskCard key={t.id} tarea={t} isSubtask={false} puedeEditar={puedeEditar}
                        onEdit={() => startEdit(t)} onDelete={() => deleteTarea(t)}
                        onUpdatePct={(p) => updatePct(t, p)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          GANTT VIEW
      ════════════════════════════════════════════════════ */}
      {view === 'gantt' && tareas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <GanttChartSquare className="w-4 h-4 text-blue-500" /> Timeline — Gantt
            </h3>
            {ganttDays.length > 0 && <span className="text-xs text-gray-400">{ganttDays.length} días</span>}
          </div>

          {ganttDays.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Agrega fechas de inicio y fin a las tareas para ver el Gantt.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(640, ganttDays.length * 32 + 260) }}>

                {/* Header */}
                <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                  <div className="w-60 flex-shrink-0 px-3 py-2 text-xs font-medium text-gray-500 border-r border-gray-200">
                    Tarea
                  </div>
                  <div className="flex">
                    {ganttDays.map((day, i) => (
                      <div key={i} style={{ width: 32 }}
                        className="flex-shrink-0 text-center border-r border-gray-100 py-1">
                        <div className="text-xs text-gray-400 leading-none">{format(day, 'd')}</div>
                        {(i === 0 || day.getDate() === 1) && (
                          <div className="text-xs font-semibold text-gray-600 leading-none mt-0.5">
                            {format(day, 'MMM', { locale: es })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Groups + subtasks */}
                {groups.map((group, gi) => {
                  const color = GROUP_COLORS[gi % GROUP_COLORS.length]
                  const subs = getChildren(group.id)
                  return (
                    <div key={group.id}>
                      {/* Group row */}
                      <div className={clsx('flex border-b border-gray-100', color.light)}>
                        <div className={clsx('w-60 flex-shrink-0 px-3 py-2.5 border-r border-gray-200 flex items-center gap-1.5')}>
                          <FolderOpen className={clsx('w-3.5 h-3.5 flex-shrink-0', color.icon)} />
                          <span className={clsx('text-xs font-semibold truncate', color.text)}>{group.nombre}</span>
                        </div>
                        <div className="relative flex-1" style={{ height: 36 }}>
                          {group.fecha_inicio && group.fecha_fin && (
                            <div
                              className={clsx('absolute top-2 h-4 rounded opacity-40', color.bar)}
                              style={{
                                left: ganttOff(group.fecha_inicio) * 32 + 2,
                                width: Math.max(32, calcDays(group.fecha_inicio, group.fecha_fin) * 32 - 4),
                              }}
                            />
                          )}
                        </div>
                      </div>
                      {/* Subtask rows */}
                      {subs.map(sub => (
                        <div key={sub.id} className="flex border-b border-gray-100 hover:bg-gray-50">
                          <div className="w-60 flex-shrink-0 px-3 py-2.5 border-r border-gray-200 flex items-center gap-1.5 pl-7">
                            <span className="text-gray-300 text-xs flex-shrink-0">└</span>
                            <span className="text-xs text-gray-600 truncate">{sub.nombre}</span>
                          </div>
                          <div className="relative flex-1" style={{ height: 36 }}>
                            {sub.fecha_inicio && sub.fecha_fin && (
                              <GanttBar
                                offset={ganttOff(sub.fecha_inicio)}
                                width={calcDays(sub.fecha_inicio, sub.fecha_fin)}
                                pct={sub.porcentaje}
                                label={sub.nombre}
                                barClass={color.bar}
                                cellW={32}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}

                {/* Standalone tasks */}
                {standalones.length > 0 && (
                  <>
                    <div className="flex bg-gray-50 border-b border-gray-200">
                      <div className="w-60 flex-shrink-0 px-3 py-1.5 text-xs font-bold text-gray-500 border-r border-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                        <ListTodo className="w-3.5 h-3.5 text-blue-400" /> Independientes
                      </div>
                      <div className="flex-1" />
                    </div>
                    {standalones.map(t => (
                      <div key={t.id} className="flex border-b border-gray-100 hover:bg-gray-50">
                        <div className="w-60 flex-shrink-0 px-3 py-2.5 border-r border-gray-200 flex items-center gap-1.5">
                          <ListTodo className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="text-xs text-gray-700 truncate">{t.nombre}</span>
                        </div>
                        <div className="relative flex-1" style={{ height: 36 }}>
                          {t.fecha_inicio && t.fecha_fin && (
                            <GanttBar
                              offset={ganttOff(t.fecha_inicio)}
                              width={calcDays(t.fecha_inicio, t.fecha_fin)}
                              pct={t.porcentaje}
                              label={t.nombre}
                              barClass="bg-blue-500"
                              cellW={32}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Gantt bar
// ─────────────────────────────────────────────────────────────
function GanttBar({ offset, width, pct, label, barClass, cellW }: {
  offset: number; width: number; pct: number; label: string; barClass: string; cellW: number
}) {
  const leftPx = offset * cellW + 2
  const widthPx = Math.max(cellW - 4, width * cellW - 4)
  return (
    <div className={clsx('absolute top-2 h-5 rounded overflow-hidden shadow-sm flex items-center', barClass)}
      style={{ left: leftPx, width: widthPx }}
      title={`${label} — ${pct}%`}>
      {/* Progress overlay (darker shade for incomplete) */}
      <div className="absolute inset-0 bg-black/25"
        style={{ left: `${pct}%` }} />
      <span className="relative z-10 text-white text-xs font-medium px-1.5 truncate">
        {pct > 0 ? `${pct}%` : label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Task row (desktop)
// ─────────────────────────────────────────────────────────────
function TaskRow({ tarea, isSubtask, puedeEditar, onEdit, onDelete, onUpdatePct }: {
  tarea: Tarea; isSubtask: boolean; puedeEditar: boolean
  onEdit: () => void; onDelete: () => void; onUpdatePct: (p: number) => void
}) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/80 group">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          {isSubtask && <span className="text-gray-300 text-xs ml-3">└</span>}
          <span className="text-sm text-gray-800">{tarea.nombre}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
        {tarea.fecha_inicio ? format(parseISO(tarea.fecha_inicio), 'dd/MM/yy') : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
        {tarea.fecha_fin ? format(parseISO(tarea.fecha_fin), 'dd/MM/yy') : '—'}
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-500">{tarea.duracion || '—'}</td>
      <td className="px-4 py-2.5 text-xs text-gray-600">{tarea.responsable?.nombre || '—'}</td>
      <td className="px-4 py-2.5">
        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          ESTADO_TAREA_COLORS[tarea.estado])}>
          {ESTADO_TAREA_LABELS[tarea.estado]}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          {puedeEditar ? (
            <input type="range" min="0" max="100" step="5"
              className="w-20 accent-blue-600 cursor-pointer"
              value={tarea.porcentaje}
              onChange={e => onUpdatePct(parseInt(e.target.value))} />
          ) : (
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full', ESTADO_TAREA_BAR[tarea.estado])}
                style={{ width: `${tarea.porcentaje}%` }} />
            </div>
          )}
          <span className="text-xs font-medium text-gray-600 w-7 text-right">{tarea.porcentaje}%</span>
        </div>
      </td>
      {puedeEditar && (
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Editar">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────
// Edit row (desktop inline editor)
// ─────────────────────────────────────────────────────────────
function EditRow({ tarea, ef, setEf, grupos, usuarios, onSave, onCancel, saving, colSpan }: {
  tarea: Tarea; ef: any; setEf: any; grupos: Tarea[]; usuarios: Perfil[]
  onSave: () => void; onCancel: () => void; saving: boolean; colSpan: number
}) {
  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Nombre</label>
            <input className={INP + ' text-xs py-1.5'} value={ef.nombre}
              onChange={e => setEf((f: any) => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Inicio</label>
            <input type="date" className={INP + ' text-xs py-1.5'} value={ef.fecha_inicio}
              onChange={e => setEf((f: any) => ({ ...f, fecha_inicio: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fin</label>
            <input type="date" className={INP + ' text-xs py-1.5'} value={ef.fecha_fin}
              onChange={e => setEf((f: any) => ({ ...f, fecha_fin: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Responsable</label>
            <select className={INP + ' text-xs py-1.5'} value={ef.responsable_id}
              onChange={e => setEf((f: any) => ({ ...f, responsable_id: e.target.value }))}>
              <option value="">Sin asignar</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select className={INP + ' text-xs py-1.5'} value={ef.estado}
              onChange={e => setEf((f: any) => ({ ...f, estado: e.target.value }))}>
              {(['not_started','in_progress','completed','delayed'] as EstadoTarea[]).map(s => (
                <option key={s} value={s}>{ESTADO_TAREA_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">% Avance</label>
            <div className="flex items-center gap-2">
              <input type="range" min="0" max="100" step="5" className="flex-1 accent-blue-600"
                value={ef.porcentaje}
                onChange={e => setEf((f: any) => ({ ...f, porcentaje: parseInt(e.target.value) }))} />
              <span className="text-xs font-bold text-blue-700 w-8 text-right">{ef.porcentaje}%</span>
            </div>
          </div>
          {tarea.tipo === 'subtask' && grupos.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Grupo padre</label>
              <select className={INP + ' text-xs py-1.5'} value={ef.padre_id}
                onChange={e => setEf((f: any) => ({ ...f, padre_id: e.target.value }))}>
                <option value="">Sin grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="md:col-span-4 flex gap-2 justify-end border-t border-blue-100 pt-3">
            <button onClick={onCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
            <button onClick={onSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Guardar cambios
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────
// Task card (mobile)
// ─────────────────────────────────────────────────────────────
function TaskCard({ tarea, isSubtask, puedeEditar, onEdit, onDelete, onUpdatePct }: {
  tarea: Tarea; isSubtask: boolean; puedeEditar: boolean
  onEdit: () => void; onDelete: () => void; onUpdatePct: (p: number) => void
}) {
  return (
    <div className={clsx('px-4 py-3', isSubtask && 'pl-7 bg-gray-50/40')}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {isSubtask && <span className="text-gray-300 text-xs">└</span>}
          <span className="text-sm font-medium text-gray-800">{tarea.nombre}</span>
        </div>
        {puedeEditar && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
        <div><span className="text-gray-400">Inicio:</span> {tarea.fecha_inicio ? format(parseISO(tarea.fecha_inicio), 'dd/MM/yy') : '—'}</div>
        <div><span className="text-gray-400">Fin:</span> {tarea.fecha_fin ? format(parseISO(tarea.fecha_fin), 'dd/MM/yy') : '—'}</div>
        <div><span className="text-gray-400">Días:</span> {tarea.duracion || '—'}</div>
        <div><span className="text-gray-400">Resp.:</span> {tarea.responsable?.nombre || '—'}</div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
          ESTADO_TAREA_COLORS[tarea.estado])}>
          {ESTADO_TAREA_LABELS[tarea.estado]}
        </span>
        {puedeEditar ? (
          <div className="flex items-center gap-2 flex-1 ml-2">
            <input type="range" min="0" max="100" step="5" className="flex-1 accent-blue-600"
              value={tarea.porcentaje} onChange={e => onUpdatePct(parseInt(e.target.value))} />
            <span className="text-xs font-bold text-blue-700 w-8 text-right">{tarea.porcentaje}%</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 ml-2">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={clsx('h-full rounded-full', ESTADO_TAREA_BAR[tarea.estado])}
                style={{ width: `${tarea.porcentaje}%` }} />
            </div>
            <span className="text-xs text-gray-500">{tarea.porcentaje}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Edit card (mobile)
// ─────────────────────────────────────────────────────────────
function EditCard({ tarea, ef, setEf, grupos, usuarios, onSave, onCancel, saving }: {
  tarea: Tarea; ef: any; setEf: any; grupos: Tarea[]; usuarios: Perfil[]
  onSave: () => void; onCancel: () => void; saving: boolean
}) {
  return (
    <div className="px-4 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nombre</label>
        <input className={INP} value={ef.nombre}
          onChange={e => setEf((f: any) => ({ ...f, nombre: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Inicio</label>
          <input type="date" className={INP + ' text-xs py-1.5'} value={ef.fecha_inicio}
            onChange={e => setEf((f: any) => ({ ...f, fecha_inicio: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Fin</label>
          <input type="date" className={INP + ' text-xs py-1.5'} value={ef.fecha_fin}
            onChange={e => setEf((f: any) => ({ ...f, fecha_fin: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Responsable</label>
        <select className={INP} value={ef.responsable_id}
          onChange={e => setEf((f: any) => ({ ...f, responsable_id: e.target.value }))}>
          <option value="">Sin asignar</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Estado</label>
        <select className={INP} value={ef.estado}
          onChange={e => setEf((f: any) => ({ ...f, estado: e.target.value }))}>
          {(['not_started','in_progress','completed','delayed'] as EstadoTarea[]).map(s => (
            <option key={s} value={s}>{ESTADO_TAREA_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">% Avance</label>
        <div className="flex items-center gap-3">
          <input type="range" min="0" max="100" step="5" className="flex-1 accent-blue-600"
            value={ef.porcentaje}
            onChange={e => setEf((f: any) => ({ ...f, porcentaje: parseInt(e.target.value) }))} />
          <span className="text-sm font-bold text-blue-700">{ef.porcentaje}%</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600">
          Cancelar
        </button>
        <button onClick={onSave} disabled={saving}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          Guardar
        </button>
      </div>
    </div>
  )
}

