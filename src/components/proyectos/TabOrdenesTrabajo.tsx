'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  Plus, Edit2, CheckCircle, Clock, Circle,
  X, UserPlus, Loader2, MapPin, Calendar,
  User, FileText, ChevronDown, ChevronUp
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ─── Types ───────────────────────────────────────────────────────────────────

type EstadoOT = 'abierta' | 'en_proceso' | 'completada'

interface TecnicoCatalogo {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  activo: boolean
}

interface OTTecnico {
  id: string
  tecnico_id: string
  tecnico: TecnicoCatalogo
}

interface OrdenTrabajo {
  id: string
  proyecto_id: string
  numero: number
  fecha_inicio: string
  lugar: string | null
  cliente_id: string | null
  descripcion: string | null
  estado: EstadoOT
  fecha_cierre: string | null
  cerrado_por_nombre: string | null
  cerrado_por_tipo: string | null
  creado_en: string
  cliente: { id: string; nombre: string } | null
  ot_tecnicos: OTTecnico[]
}

interface Cliente {
  id: string
  nombre: string
}

interface Perfil {
  id: string
  nombre: string
  rol: string
}

interface TabOrdenesTrabajoProps {
  proyectoId: string
  userRol: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<EstadoOT, {
  label: string
  color: string
  dot: string
  Icon: React.ComponentType<{ className?: string }>
}> = {
  abierta:    { label: 'Abierta',    color: 'bg-blue-50 text-blue-700 border-blue-200',    dot: 'bg-blue-400',    Icon: Circle        },
  en_proceso: { label: 'En Proceso', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400',   Icon: Clock         },
  completada: { label: 'Completada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', Icon: CheckCircle },
}

const CAN_EDIT_ROLES  = ['administrador', 'arquitecto_ingeniero', 'implementador', 'tecnico']
const CAN_DELETE_ROLES = ['administrador', 'arquitecto_ingeniero', 'implementador']

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => String(n).padStart(3, '0')
const fmtDate = (d: string) => format(new Date(d), 'd MMM yyyy', { locale: es })

// ─── Component ───────────────────────────────────────────────────────────────

export default function TabOrdenesTrabajo({ proyectoId, userRol }: TabOrdenesTrabajoProps) {
  // ── Data state ──
  const [ordenes,  setOrdenes]  = useState<OrdenTrabajo[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tecnicos, setTecnicos] = useState<TecnicoCatalogo[]>([])
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // ── UI state ──
  const [showForm,   setShowForm]   = useState(false)
  const [editingOT,  setEditingOT]  = useState<OrdenTrabajo | null>(null)
  const [closingOT,  setClosingOT]  = useState<OrdenTrabajo | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)

  // ── Form state ──
  const emptyForm = {
    fecha_inicio: new Date().toISOString().split('T')[0],
    lugar: '',
    cliente_id: '',
    descripcion: '',
    tecnico_ids: [] as string[],
  }
  const [form, setForm] = useState(emptyForm)

  // ── Close OT state ──
  const [closeForm, setCloseForm] = useState({
    fecha_cierre: new Date().toISOString().split('T')[0],
    cerrado_por_key: '',   // "usuario__Nombre" or "tecnico__Nombre"
  })

  // ── New technician inline ──
  const [showNewTec, setShowNewTec] = useState(false)
  const [newTec, setNewTec] = useState({ nombre: '', email: '', telefono: '' })
  const [savingTec, setSavingTec] = useState(false)

  // ── New client inline ──
  const [showNewCli, setShowNewCli] = useState(false)
  const [newCli, setNewCli] = useState({ nombre: '' })
  const [savingCli, setSavingCli] = useState(false)

  // ── Permissions ──
  const canEdit   = CAN_EDIT_ROLES.includes(userRol)
  const canDelete = CAN_DELETE_ROLES.includes(userRol)

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: ots }, { data: clis }, { data: tecs }, { data: profs }] = await Promise.all([
        supabase
          .from('ordenes_trabajo')
          .select(`
            *,
            cliente:clientes(id, nombre),
            ot_tecnicos(id, tecnico_id, tecnico:tecnicos_catalogo(id, nombre, email, telefono, activo))
          `)
          .eq('proyecto_id', proyectoId)
          .order('numero', { ascending: true }),

        supabase.from('clientes').select('id, nombre').order('nombre'),

        supabase.from('tecnicos_catalogo').select('*').eq('activo', true).order('nombre'),

        supabase.from('perfiles').select('id, nombre, rol').eq('activo', true).order('nombre'),
      ])

      setOrdenes(ots ?? [])
      setClientes(clis ?? [])
      setTecnicos(tecs ?? [])
      setPerfiles(profs ?? [])
    } catch {
      setError('Error al cargar las órdenes de trabajo.')
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { loadData() }, [loadData])

  // ─── Form handlers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingOT(null)
    setForm(emptyForm)
    setShowNewTec(false)
    setShowNewCli(false)
    setShowForm(true)
  }

  const openEdit = (ot: OrdenTrabajo) => {
    setEditingOT(ot)
    setForm({
      fecha_inicio: ot.fecha_inicio,
      lugar:        ot.lugar ?? '',
      cliente_id:   ot.cliente_id ?? '',
      descripcion:  ot.descripcion ?? '',
      tecnico_ids:  ot.ot_tecnicos.map(t => t.tecnico_id),
    })
    setShowNewTec(false)
    setShowNewCli(false)
    setShowForm(true)
  }

  const closeForm_reset = () => {
    setShowForm(false)
    setEditingOT(null)
    setShowNewTec(false)
    setShowNewCli(false)
  }

  const toggleTecnico = (id: string) =>
    setForm(p => ({
      ...p,
      tecnico_ids: p.tecnico_ids.includes(id)
        ? p.tecnico_ids.filter(t => t !== id)
        : [...p.tecnico_ids, id],
    }))

  // ─── Save OT ───────────────────────────────────────────────────────────────

  const saveOT = async () => {
    if (!form.fecha_inicio) return
    setSaving(true)
    try {
      const payload = {
        fecha_inicio: form.fecha_inicio,
        lugar:        form.lugar || null,
        cliente_id:   form.cliente_id || null,
        descripcion:  form.descripcion || null,
      }

      let ordenId = editingOT?.id

      if (editingOT) {
        await supabase.from('ordenes_trabajo').update(payload).eq('id', editingOT.id)
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: newOT, error: insertErr } = await supabase
          .from('ordenes_trabajo')
          .insert({ ...payload, proyecto_id: proyectoId, creado_por: user?.id })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        ordenId = newOT.id
      }

      // Sync técnicos: wipe + re-insert
      await supabase.from('ot_tecnicos').delete().eq('orden_id', ordenId!)
      if (form.tecnico_ids.length > 0) {
        await supabase.from('ot_tecnicos').insert(
          form.tecnico_ids.map(tid => ({ orden_id: ordenId!, tecnico_id: tid }))
        )
      }

      closeForm_reset()
      await loadData()
    } catch {
      alert('Error al guardar la orden. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Status transitions ────────────────────────────────────────────────────

  const advanceStatus = async (ot: OrdenTrabajo) => {
    if (ot.estado === 'abierta') {
      await supabase.from('ordenes_trabajo').update({ estado: 'en_proceso' }).eq('id', ot.id)
      await loadData()
      return
    }
    if (ot.estado === 'en_proceso') {
      setClosingOT(ot)
      setCloseForm({
        fecha_cierre:    new Date().toISOString().split('T')[0],
        cerrado_por_key: '',
      })
    }
  }

  const confirmClose = async () => {
    if (!closingOT || !closeForm.cerrado_por_key) return
    setSaving(true)
    try {
      const [tipo, ...rest] = closeForm.cerrado_por_key.split('__')
      const nombre = rest.join('__')
      await supabase
        .from('ordenes_trabajo')
        .update({
          estado:            'completada',
          fecha_cierre:      closeForm.fecha_cierre,
          cerrado_por_nombre: nombre,
          cerrado_por_tipo:  tipo,
        })
        .eq('id', closingOT.id)
      setClosingOT(null)
      await loadData()
    } catch {
      alert('Error al cerrar la orden.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete OT ─────────────────────────────────────────────────────────────

  const deleteOT = async (ot: OrdenTrabajo) => {
    if (!confirm(`¿Eliminar OT #${fmtNum(ot.numero)}? Esta acción no se puede deshacer.`)) return
    await supabase.from('ordenes_trabajo').delete().eq('id', ot.id)
    await loadData()
  }

  // ─── Add new technician ────────────────────────────────────────────────────

  const addTecnico = async () => {
    if (!newTec.nombre.trim()) return
    setSavingTec(true)
    try {
      const { data, error } = await supabase
        .from('tecnicos_catalogo')
        .insert({ nombre: newTec.nombre.trim(), email: newTec.email || null, telefono: newTec.telefono || null })
        .select()
        .single()
      if (error) throw error
      setTecnicos(p => [...p, data])
      setForm(p => ({ ...p, tecnico_ids: [...p.tecnico_ids, data.id] }))
      setNewTec({ nombre: '', email: '', telefono: '' })
      setShowNewTec(false)
    } catch {
      alert('Error al agregar el técnico.')
    } finally {
      setSavingTec(false)
    }
  }

  // ─── Add new client ────────────────────────────────────────────────────────

  const addCliente = async () => {
    if (!newCli.nombre.trim()) return
    setSavingCli(true)
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({ nombre: newCli.nombre.trim() })
        .select('id, nombre')
        .single()
      if (error) throw error
      setClientes(p => [...p, data])
      setForm(p => ({ ...p, cliente_id: data.id }))
      setNewCli({ nombre: '' })
      setShowNewCli(false)
    } catch {
      alert('Error al agregar el cliente. Completa sus datos desde el módulo Clientes.')
    } finally {
      setSavingCli(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  )

  if (error) return (
    <div className="text-center py-12 text-red-500 text-sm">{error}</div>
  )

  // Dropdown options for "cerrado por" (system users + technicians)
  const cerradoPorOptions = [
    ...perfiles.map(p => ({ key: `usuario__${p.nombre}`, label: p.nombre, group: 'Usuarios del sistema' })),
    ...tecnicos.map(t => ({ key: `tecnico__${t.nombre}`, label: t.nombre, group: 'Técnicos' })),
  ]

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Órdenes de Trabajo</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {ordenes.length === 0
              ? 'Sin órdenes registradas'
              : `${ordenes.length} orden${ordenes.length !== 1 ? 'es' : ''} · ${ordenes.filter(o => o.estado !== 'completada').length} activa${ordenes.filter(o => o.estado !== 'completada').length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva OT
          </button>
        )}
      </div>

      {/* ── Status summary pills ── */}
      {ordenes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(['abierta', 'en_proceso', 'completada'] as EstadoOT[]).map(estado => {
            const count = ordenes.filter(o => o.estado === estado).length
            if (count === 0) return null
            const cfg = ESTADO_CONFIG[estado]
            return (
              <span key={estado} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}: {count}
              </span>
            )
          })}
        </div>
      )}

      {/* ── Empty state ── */}
      {ordenes.length === 0 && (
        <div className="text-center py-14 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No hay órdenes de trabajo para este proyecto.</p>
          {canEdit && (
            <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline">
              + Crear primera orden de trabajo
            </button>
          )}
        </div>
      )}

      {/* ── OT Cards ── */}
      <div className="space-y-3">
        {ordenes.map(ot => {
          const cfg = ESTADO_CONFIG[ot.estado]
          const OTIcon = cfg.Icon
          const isExpanded = expandedId === ot.id

          return (
            <div
              key={ot.id}
              className={`bg-white border rounded-xl transition-all ${
                ot.estado === 'completada' ? 'border-gray-200 opacity-80' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Card header */}
              <div className="flex items-start gap-3 p-4">

                {/* OT Number */}
                <div className="shrink-0 w-12 text-right">
                  <span className="text-xl font-bold text-gray-200 leading-none">
                    {fmtNum(ot.numero)}
                  </span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                      <OTIcon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    {ot.cliente && (
                      <span className="text-xs text-gray-600 font-medium">{ot.cliente.nombre}</span>
                    )}
                  </div>

                  {/* Place + dates row */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {ot.lugar && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {ot.lugar}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {fmtDate(ot.fecha_inicio)}
                      {ot.fecha_cierre && (
                        <> → Cerrado {fmtDate(ot.fecha_cierre)}</>
                      )}
                    </span>
                  </div>

                  {/* Technicians */}
                  {ot.ot_tecnicos.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ot.ot_tecnicos.map(t => (
                        <span key={t.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          <User className="w-2.5 h-2.5" />
                          {t.tecnico.nombre}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Closed by */}
                  {ot.estado === 'completada' && ot.cerrado_por_nombre && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Cerrado por: <span className="font-medium">{ot.cerrado_por_nombre}</span>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Expand/collapse description */}
                  {ot.descripcion && (
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ot.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg"
                      title="Ver descripción"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}

                  {canEdit && ot.estado !== 'completada' && (
                    <>
                      {/* Advance status */}
                      <button
                        onClick={() => advanceStatus(ot)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                          ot.estado === 'abierta'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {ot.estado === 'abierta' ? 'Iniciar' : 'Completar'}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => openEdit(ot)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar OT"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => deleteOT(ot)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar OT"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expandable description */}
              {isExpanded && ot.descripcion && (
                <div className="px-4 pb-4 pt-0">
                  <div className="ml-15 pl-3 border-l-2 border-gray-100">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{ot.descripcion}</p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODAL — Create / Edit OT
      ════════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {editingOT
                    ? `Editar OT #${fmtNum(editingOT.numero)}`
                    : 'Nueva Orden de Trabajo'}
                </h3>
                {!editingOT && (
                  <p className="text-xs text-gray-400 mt-0.5">El número se asignará automáticamente</p>
                )}
              </div>
              <button onClick={closeForm_reset} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Fecha inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Lugar */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Lugar / Dirección
                </label>
                <input
                  type="text"
                  placeholder="Ej: Torre A, Piso 3 · Av. Principal 450"
                  value={form.lugar}
                  onChange={e => setForm(p => ({ ...p, lugar: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente</label>
                <div className="flex gap-2">
                  <select
                    value={form.cliente_id}
                    onChange={e => setForm(p => ({ ...p, cliente_id: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">Sin cliente asignado</option>
                    {clientes.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCli(v => !v)}
                    className="p-2.5 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Agregar nuevo cliente"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>

                {showNewCli && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                    <p className="text-xs font-medium text-blue-700">Nuevo cliente (básico)</p>
                    <input
                      type="text"
                      placeholder="Nombre del cliente *"
                      value={newCli.nombre}
                      onChange={e => setNewCli(p => ({ ...p, nombre: e.target.value }))}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addCliente}
                        disabled={savingCli || !newCli.nombre.trim()}
                        className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {savingCli && <Loader2 className="w-3 h-3 animate-spin" />}
                        Agregar
                      </button>
                      <button
                        onClick={() => setShowNewCli(false)}
                        className="flex-1 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Técnicos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Técnicos asignados
                  {form.tecnico_ids.length > 0 && (
                    <span className="ml-2 text-xs text-blue-600 font-normal">
                      {form.tecnico_ids.length} seleccionado{form.tecnico_ids.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </label>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {tecnicos.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      No hay técnicos en el catálogo. Agrega uno abajo.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                      {tecnicos.map(t => (
                        <label
                          key={t.id}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={form.tecnico_ids.includes(t.id)}
                            onChange={() => toggleTecnico(t.id)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-sm text-gray-800">{t.nombre}</span>
                            {t.telefono && (
                              <span className="text-xs text-gray-400 ml-2">{t.telefono}</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowNewTec(v => !v)}
                  className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Agregar nuevo técnico al catálogo
                </button>

                {showNewTec && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                    <p className="text-xs font-medium text-blue-700">Nuevo técnico</p>
                    <input
                      type="text"
                      placeholder="Nombre completo *"
                      value={newTec.nombre}
                      onChange={e => setNewTec(p => ({ ...p, nombre: e.target.value }))}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="email"
                      placeholder="Email (opcional)"
                      value={newTec.email}
                      onChange={e => setNewTec(p => ({ ...p, email: e.target.value }))}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="tel"
                      placeholder="Teléfono (opcional)"
                      value={newTec.telefono}
                      onChange={e => setNewTec(p => ({ ...p, telefono: e.target.value }))}
                      className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addTecnico}
                        disabled={savingTec || !newTec.nombre.trim()}
                        className="flex-1 py-1.5 bg-blue-600 text-white text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {savingTec && <Loader2 className="w-3 h-3 animate-spin" />}
                        Agregar al catálogo
                      </button>
                      <button
                        onClick={() => setShowNewTec(false)}
                        className="flex-1 py-1.5 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descripción del trabajo
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalla el trabajo a realizar en esta orden…"
                  value={form.descripcion}
                  onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t shrink-0">
              <button
                onClick={saveOT}
                disabled={saving || !form.fecha_inicio}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingOT ? 'Guardar cambios' : 'Crear orden de trabajo'}
              </button>
              <button
                onClick={closeForm_reset}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — Cerrar OT (completar)
      ════════════════════════════════════════════════════════════ */}
      {closingOT && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Cerrar OT #{fmtNum(closingOT.numero)}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {closingOT.lugar ?? 'Sin lugar especificado'}
                </p>
              </div>
              <button onClick={() => setClosingOT(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha de cierre <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={closeForm.fecha_cierre}
                  onChange={e => setCloseForm(p => ({ ...p, fecha_cierre: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cerrado por <span className="text-red-500">*</span>
                </label>
                <select
                  value={closeForm.cerrado_por_key}
                  onChange={e => setCloseForm(p => ({ ...p, cerrado_por_key: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">Seleccionar persona…</option>
                  <optgroup label="👤 Usuarios del sistema">
                    {perfiles.map(p => (
                      <option key={p.id} value={`usuario__${p.nombre}`}>{p.nombre}</option>
                    ))}
                  </optgroup>
                  <optgroup label="🔧 Técnicos">
                    {tecnicos.map(t => (
                      <option key={t.id} value={`tecnico__${t.nombre}`}>{t.nombre}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t">
              <button
                onClick={confirmClose}
                disabled={saving || !closeForm.fecha_cierre || !closeForm.cerrado_por_key}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar cierre
              </button>
              <button
                onClick={() => setClosingOT(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
