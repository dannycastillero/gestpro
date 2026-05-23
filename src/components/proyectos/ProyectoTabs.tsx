'use client'

import { useState, useEffect } from 'react'
import TabWBS from '@/components/proyectos/TabWBS'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Info, Package, BookOpen, DollarSign, Plus, Upload, GanttChartSquare,
  Trash2, ChevronDown, Save, X, FileText, Image, ClipboardList
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Proyecto, Perfil, Recurso, BitacoraEntrada, CostoProyecto, ESTADOS_CON_WBS,
  EstadoProyecto, TipoRecurso, TipoBitacora, CategoriaCategoria,
  ESTADO_LABELS, TIPO_RECURSO_LABELS, CATEGORIA_COSTO_LABELS,
  PUEDE_EDITAR_COSTOS, PUEDE_CREAR_PROYECTOS
} from '@/types'
import clsx from 'clsx'

const ESTADOS: EstadoProyecto[] = ['iniciacion', 'planificacion', 'en_ejecucion', 'remediacion_garantia', 'cerrado']

interface Props {
  proyecto: any
  perfil: Perfil | null
  activeTab: string
  puedePrecio: boolean
  puedeEditar: boolean
  puedeEditarWBS?: boolean
}

export default function ProyectoTabs({ proyecto, perfil, activeTab, puedePrecio, puedeEditar, puedeEditarWBS }: Props) {
  const [tab, setTab] = useState(activeTab)
  const supabase = createClient()
  const router = useRouter()

  const tabs = [
    { id: 'info', label: 'Info', icon: Info },
    { id: 'recursos', label: 'Recursos', icon: Package },
    { id: 'bitacora', label: 'Bitácora', icon: BookOpen },
    ...(puedePrecio ? [{ id: 'costos', label: 'Costos', icon: DollarSign }] : []),
    ...(ESTADOS_CON_WBS.includes(proyecto.estado) ? [{ id: 'wbs', label: 'Tareas / WBS', icon: GanttChartSquare }] : []),
  ]

  return (
    <div>
      {/* Tab nav */}
      <div className="border-b border-gray-200 flex gap-1 mb-6 -mx-1 px-1 overflow-x-auto scrollbar-thin">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-2', tab === t.id ? 'tab-btn-active' : 'tab-btn')}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && <TabInfo proyecto={proyecto} perfil={perfil} puedePrecio={puedePrecio} puedeEditar={puedeEditar} supabase={supabase} router={router} />}
      {tab === 'recursos' && <TabRecursos proyecto={proyecto} perfil={perfil} puedePrecio={puedePrecio} puedeEditar={puedeEditar} supabase={supabase} />}
      {tab === 'bitacora' && <TabBitacora proyecto={proyecto} perfil={perfil} supabase={supabase} />}
      {tab === 'costos' && puedePrecio && <TabCostos proyecto={proyecto} perfil={perfil} supabase={supabase} />}
      {tab === 'wbs' && ESTADOS_CON_WBS.includes(proyecto.estado) && (
        <TabWBS proyectoId={proyecto.id} perfil={perfil} puedeEditar={puedeEditarWBS ?? puedeEditar} />
      )}
    </div>
  )
}

// ── TAB INFO ─────────────────────────────────────────────────
function TabInfo({ proyecto, perfil, puedePrecio, puedeEditar, supabase, router }: any) {
  const [estado, setEstado] = useState(proyecto.estado)
  const [saving, setSaving] = useState(false)

  async function cambiarEstado(nuevoEstado: EstadoProyecto) {
    setSaving(true)
    await supabase.from('proyectos').update({ estado: nuevoEstado }).eq('id', proyecto.id)
    // Log en bitácora
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('bitacora').insert({
      proyecto_id: proyecto.id,
      usuario_id: user?.id,
      contenido: `Estado cambiado de "${ESTADO_LABELS[estado as EstadoProyecto]}" a "${ESTADO_LABELS[nuevoEstado]}"`,
      tipo: 'cambio_estado',
      estado_anterior: estado,
      estado_nuevo: nuevoEstado,
    })
    setEstado(nuevoEstado)
    setSaving(false)
    router.refresh()
  }

  const fmtDate = (d?: string) => d ? format(new Date(d), 'dd/MM/yyyy') : '—'
  const fmtMoney = (n?: number) => n != null ? `$${n.toLocaleString('es', { minimumFractionDigits: 2 })}` : '—'

  return (
    <div className="space-y-5">
      {/* Estado */}
      {puedeEditar && (
        <div className="card p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Cambiar estado del proyecto</h3>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map(e => (
              <button
                key={e}
                onClick={() => cambiarEstado(e)}
                disabled={saving || e === estado}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                  e === estado
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                )}
              >
                {ESTADO_LABELS[e]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detalles */}
      <div className="card">
        <div className="card-header"><h3 className="font-medium text-gray-900">Detalles del proyecto</h3></div>
        <div className="card-body">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><dt className="text-xs text-gray-500 mb-1">Cliente</dt><dd className="font-medium">{proyecto.cliente?.nombre}</dd></div>
            <div><dt className="text-xs text-gray-500 mb-1">Fecha inicio</dt><dd>{fmtDate(proyecto.fecha_inicio)}</dd></div>
            <div><dt className="text-xs text-gray-500 mb-1">Fin estimado</dt><dd>{fmtDate(proyecto.fecha_fin_estimada)}</dd></div>
            {proyecto.fecha_fin_real && <div><dt className="text-xs text-gray-500 mb-1">Fin real</dt><dd>{fmtDate(proyecto.fecha_fin_real)}</dd></div>}
            {puedePrecio && <div><dt className="text-xs text-gray-500 mb-1">Valor bruto</dt><dd className="font-semibold text-green-700">{fmtMoney(proyecto.valor_bruto)}</dd></div>}
          </dl>
        </div>
      </div>

      {proyecto.descripcion && (
        <div className="card">
          <div className="card-header"><h3 className="font-medium text-gray-900">Descripción</h3></div>
          <div className="card-body"><p className="text-sm text-gray-700 whitespace-pre-wrap">{proyecto.descripcion}</p></div>
        </div>
      )}

      {proyecto.alcance && (
        <div className="card">
          <div className="card-header"><h3 className="font-medium text-gray-900">Alcance del trabajo</h3></div>
          <div className="card-body"><p className="text-sm text-gray-700 whitespace-pre-wrap">{proyecto.alcance}</p></div>
        </div>
      )}
    </div>
  )
}

// ── TAB RECURSOS ─────────────────────────────────────────────
function TabRecursos({ proyecto, perfil, puedePrecio, puedeEditar, supabase }: any) {
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ nombre: '', descripcion: '', cantidad: '1', unidad: 'unidad', tipo: 'material' as TipoRecurso, costo_interno: '', precio_venta: '', tiene_costo_cliente: false })

  useEffect(() => { loadRecursos() }, [])

  async function loadRecursos() {
    const { data } = await supabase.from('recursos').select('*, creador:perfiles!creado_por(nombre)').eq('proyecto_id', proyecto.id).order('creado_en')
    setRecursos(data || [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('recursos').insert({
      proyecto_id: proyecto.id,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      cantidad: parseInt(form.cantidad),
      unidad: form.unidad,
      tipo: form.tipo,
      costo_interno: form.costo_interno ? parseFloat(form.costo_interno) : null,
      precio_venta: form.precio_venta ? parseFloat(form.precio_venta) : null,
      tiene_costo_cliente: form.tiene_costo_cliente,
      creado_por: user?.id,
    })
    setShowForm(false)
    setForm({ nombre: '', descripcion: '', cantidad: '1', unidad: 'unidad', tipo: 'material', costo_interno: '', precio_venta: '', tiene_costo_cliente: false })
    loadRecursos()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este recurso?')) return
    await supabase.from('recursos').delete().eq('id', id)
    loadRecursos()
  }

  const totalVenta = recursos.reduce((s, r) => s + (r.precio_venta || 0) * r.cantidad, 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{recursos.length} recurso(s)</p>
        {puedeEditar && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus className="w-4 h-4" /> Agregar recurso
          </button>
        )}
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="card p-5">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="form-grid">
              <div>
                <label className="input-label">Nombre *</label>
                <input className="input-field" value={form.nombre} onChange={e => setForm(f => ({...f, nombre: e.target.value}))} required />
              </div>
              <div>
                <label className="input-label">Tipo *</label>
                <select className="select-field" value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value as TipoRecurso}))}>
                  {Object.entries(TIPO_RECURSO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Cantidad</label>
                <input type="number" min="1" className="input-field" value={form.cantidad} onChange={e => setForm(f => ({...f, cantidad: e.target.value}))} />
              </div>
              <div>
                <label className="input-label">Unidad</label>
                <input className="input-field" value={form.unidad} onChange={e => setForm(f => ({...f, unidad: e.target.value}))} />
              </div>
              <div>
                <label className="input-label">Precio de venta ($)</label>
                <input type="number" min="0" step="0.01" className="input-field" value={form.precio_venta} onChange={e => setForm(f => ({...f, precio_venta: e.target.value}))} />
              </div>
              {puedePrecio && (
                <div>
                  <label className="input-label">Costo interno ($) 🔒</label>
                  <input type="number" min="0" step="0.01" className="input-field" value={form.costo_interno} onChange={e => setForm(f => ({...f, costo_interno: e.target.value}))} />
                </div>
              )}
              <div className="md:col-span-2">
                <label className="input-label">Descripción</label>
                <input className="input-field" value={form.descripcion} onChange={e => setForm(f => ({...f, descripcion: e.target.value}))} />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <input type="checkbox" id="costo_cliente" checked={form.tiene_costo_cliente} onChange={e => setForm(f => ({...f, tiene_costo_cliente: e.target.checked}))} className="w-4 h-4" />
                <label htmlFor="costo_cliente" className="text-sm text-gray-700">Tiene costo al cliente (venta)</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>Cantidad</th>
              <th>Precio venta</th>
              {puedePrecio && <th>Costo interno 🔒</th>}
              <th>Cliente</th>
              {puedeEditar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {recursos.map(r => (
              <tr key={r.id}>
                <td>
                  <p className="font-medium">{r.nombre}</p>
                  {r.descripcion && <p className="text-xs text-gray-400">{r.descripcion}</p>}
                </td>
                <td className="text-xs text-gray-600">{TIPO_RECURSO_LABELS[r.tipo]}</td>
                <td>{r.cantidad} {r.unidad}</td>
                <td>{r.precio_venta != null ? `$${(r.precio_venta * r.cantidad).toLocaleString('es', { minimumFractionDigits: 2 })}` : '—'}</td>
                {puedePrecio && <td className="text-red-600">{r.costo_interno != null ? `$${(r.costo_interno * r.cantidad).toLocaleString('es', { minimumFractionDigits: 2 })}` : '—'}</td>}
                <td><span className={`badge ${r.tiene_costo_cliente ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{r.tiene_costo_cliente ? 'Sí' : 'No'}</span></td>
                {puedeEditar && (
                  <td>
                    <button onClick={() => handleDelete(r.id)} className="btn-ghost text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {recursos.length === 0 && !loading && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin recursos registrados</td></tr>
            )}
          </tbody>
          {recursos.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-700">Total venta</td>
                <td className="px-4 py-2 font-semibold text-gray-900">${totalVenta.toLocaleString('es', { minimumFractionDigits: 2 })}</td>
                {puedePrecio && <td></td>}
                <td></td>
                {puedeEditar && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ── TAB BITÁCORA ──────────────────────────────────────────────
function TabBitacora({ proyecto, perfil, supabase }: any) {
  const [entradas, setEntradas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [contenido, setContenido] = useState('')
  const [tipo, setTipo] = useState<TipoBitacora>('actualizacion')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { loadBitacora() }, [])

  async function loadBitacora() {
    const { data } = await supabase.from('bitacora')
      .select('*, usuario:perfiles!usuario_id(nombre, rol)')
      .eq('proyecto_id', proyecto.id)
      .order('creado_en', { ascending: false })
    setEntradas(data || [])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contenido.trim()) return
    setSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    let archivo_url = null, archivo_nombre = null, archivo_tipo_val = null

    if (archivo) {
      const ext = archivo.name.split('.').pop()
      const path = `${proyecto.id}/${Date.now()}.${ext}`
      const { data: up } = await supabase.storage.from('bitacora-archivos').upload(path, archivo)
      if (up) {
        const { data: url } = supabase.storage.from('bitacora-archivos').getPublicUrl(path)
        archivo_url = url.publicUrl
        archivo_nombre = archivo.name
        archivo_tipo_val = archivo.type.startsWith('image/') ? 'imagen' : 'documento'
      }
    }

    await supabase.from('bitacora').insert({
      proyecto_id: proyecto.id,
      usuario_id: user?.id,
      contenido,
      tipo,
      archivo_url,
      archivo_nombre,
      archivo_tipo: archivo_tipo_val,
    })

    setContenido('')
    setArchivo(null)
    setTipo('actualizacion')
    setSubmitting(false)
    loadBitacora()
  }

  const TIPO_LABELS: Record<TipoBitacora, string> = {
    actualizacion: 'Actualización', nota: 'Nota', cambio_estado: 'Cambio de estado',
    problema: 'Problema', resolucion: 'Resolución'
  }
  const TIPO_COLORS: Record<TipoBitacora, string> = {
    actualizacion: 'bg-blue-100 text-blue-700', nota: 'bg-gray-100 text-gray-600',
    cambio_estado: 'bg-purple-100 text-purple-700', problema: 'bg-red-100 text-red-700',
    resolucion: 'bg-green-100 text-green-700'
  }

  return (
    <div className="space-y-5">
      {/* Nueva entrada */}
      <div className="card">
        <div className="card-header"><h3 className="font-medium text-gray-900">Nueva entrada</h3></div>
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="input-label">Tipo</label>
                <select className="select-field" value={tipo} onChange={e => setTipo(e.target.value as TipoBitacora)}>
                  {Object.entries(TIPO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="input-label">Descripción *</label>
              <textarea className="textarea-field" rows={4} value={contenido} onChange={e => setContenido(e.target.value)} placeholder="Describe la actualización del proyecto..." required />
            </div>
            <div>
              <label className="input-label">Adjuntar archivo (foto o documento)</label>
              <input type="file" accept="image/*,.pdf,.doc,.docx,.xlsx" className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" onChange={e => setArchivo(e.target.files?.[0] || null)} />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary" disabled={submitting}>
                <BookOpen className="w-4 h-4" /> {submitting ? 'Guardando...' : 'Agregar entrada'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {entradas.map((e: any) => (
          <div key={e.id} className="card p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${TIPO_COLORS[e.tipo as TipoBitacora]}`}>{TIPO_LABELS[e.tipo as TipoBitacora]}</span>
                <span className="text-sm font-medium text-gray-700">{e.usuario?.nombre}</span>
                <span className="text-xs text-gray-400">{format(new Date(e.creado_en), "d MMM yyyy 'a las' HH:mm", { locale: es })}</span>
              </div>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{e.contenido}</p>
            {e.archivo_url && (
              <div className="mt-3">
                {e.archivo_tipo === 'imagen' ? (
                  <img src={e.archivo_url} alt={e.archivo_nombre} className="max-h-48 rounded-lg border border-gray-200" />
                ) : (
                  <a href={e.archivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline">
                    <FileText className="w-4 h-4" /> {e.archivo_nombre}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
        {entradas.length === 0 && !loading && (
          <div className="empty-state">
            <ClipboardList className="w-10 h-10 mb-2 text-gray-300" />
            <p>Sin entradas en la bitácora</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TAB COSTOS 🔒 ─────────────────────────────────────────────
function TabCostos({ proyecto, perfil, supabase }: any) {
  const [costos, setCostos] = useState<CostoProyecto[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ concepto: '', categoria: 'materiales' as CategoriaCategoria, monto: '', fecha: new Date().toISOString().split('T')[0], notas: '' })

  const puedeEditar = perfil && PUEDE_EDITAR_COSTOS.includes(perfil.rol)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from('costos_proyecto').select('*, registrador:perfiles!registrado_por(nombre)').eq('proyecto_id', proyecto.id).order('fecha', { ascending: false }),
      supabase.from('recursos').select('*').eq('proyecto_id', proyecto.id)
    ])
    setCostos(c || [])
    setRecursos(r || [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('costos_proyecto').insert({
      proyecto_id: proyecto.id,
      concepto: form.concepto,
      categoria: form.categoria,
      monto: parseFloat(form.monto),
      fecha: form.fecha,
      notas: form.notas || null,
      registrado_por: user?.id,
    })
    setShowForm(false)
    setForm({ concepto: '', categoria: 'materiales', monto: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este costo?')) return
    await supabase.from('costos_proyecto').delete().eq('id', id)
    loadData()
  }

  const totalCostos = costos.reduce((s, c) => s + c.monto, 0)
  const costoRecursos = recursos.reduce((s, r) => s + (r.costo_interno || 0) * r.cantidad, 0)
  const costoTotal = totalCostos + costoRecursos
  const margen = proyecto.valor_bruto ? proyecto.valor_bruto - costoTotal : null

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Valor bruto</p>
          <p className="text-lg font-bold text-gray-900">{proyecto.valor_bruto != null ? `$${proyecto.valor_bruto.toLocaleString('es', {minimumFractionDigits:2})}` : '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Costos registrados</p>
          <p className="text-lg font-bold text-red-600">${costoTotal.toLocaleString('es', {minimumFractionDigits:2})}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Recursos (costo interno)</p>
          <p className="text-lg font-bold text-orange-600">${costoRecursos.toLocaleString('es', {minimumFractionDigits:2})}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Margen estimado</p>
          <p className={`text-lg font-bold ${margen == null ? 'text-gray-400' : margen >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {margen != null ? `$${margen.toLocaleString('es', {minimumFractionDigits:2})}` : '—'}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900">Costos adicionales</h3>
        {puedeEditar && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus className="w-4 h-4" /> Agregar costo
          </button>
        )}
      </div>

      {showForm && (
        <div className="card p-5">
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="form-grid">
              <div>
                <label className="input-label">Concepto *</label>
                <input className="input-field" value={form.concepto} onChange={e => setForm(f => ({...f, concepto: e.target.value}))} required />
              </div>
              <div>
                <label className="input-label">Categoría</label>
                <select className="select-field" value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value as CategoriaCategoria}))}>
                  {Object.entries(CATEGORIA_COSTO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Monto ($) *</label>
                <input type="number" min="0" step="0.01" className="input-field" value={form.monto} onChange={e => setForm(f => ({...f, monto: e.target.value}))} required />
              </div>
              <div>
                <label className="input-label">Fecha</label>
                <input type="date" className="input-field" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))} />
              </div>
              <div className="md:col-span-2">
                <label className="input-label">Notas</label>
                <input className="input-field" value={form.notas} onChange={e => setForm(f => ({...f, notas: e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla costos */}
      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Categoría</th>
              <th>Monto</th>
              <th>Fecha</th>
              <th>Registrado por</th>
              {puedeEditar && <th></th>}
            </tr>
          </thead>
          <tbody>
            {costos.map(c => (
              <tr key={c.id}>
                <td>
                  <p className="font-medium">{c.concepto}</p>
                  {c.notas && <p className="text-xs text-gray-400">{c.notas}</p>}
                </td>
                <td className="text-xs text-gray-600">{c.categoria ? CATEGORIA_COSTO_LABELS[c.categoria] : '—'}</td>
                <td className="font-medium text-red-600">${c.monto.toLocaleString('es', {minimumFractionDigits:2})}</td>
                <td className="text-xs text-gray-500">{format(new Date(c.fecha), 'dd/MM/yyyy')}</td>
                <td className="text-xs text-gray-500">{(c as any).registrador?.nombre || '—'}</td>
                {puedeEditar && (
                  <td>
                    <button onClick={() => handleDelete(c.id)} className="btn-ghost text-red-400 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {costos.length === 0 && !loading && (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin costos adicionales registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
