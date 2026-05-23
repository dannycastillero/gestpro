'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { PUEDE_VER_COSTOS, Rol } from '@/types'

type ClienteBasico = { id: string; nombre: string }

export default function NuevoProyectoPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clientes, setClientes] = useState<ClienteBasico[]>([])
  const [userRol, setUserRol] = useState('')
  const [form, setForm] = useState({
    titulo: '', cliente_id: '', descripcion: '', alcance: '',
    fecha_inicio: '', fecha_fin_estimada: '', valor_bruto: ''
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: cl }, { data: pf }] = await Promise.all([
        supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('perfiles').select('rol').eq('id', user.id).single()
      ])
      setClientes((cl as ClienteBasico[]) || [])
      setUserRol(pf?.rol || '')
    }
    load()
  }, [])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('proyectos').insert({
      titulo: form.titulo,
      cliente_id: form.cliente_id,
      descripcion: form.descripcion || null,
      alcance: form.alcance || null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin_estimada: form.fecha_fin_estimada || null,
      valor_bruto: form.valor_bruto ? parseFloat(form.valor_bruto) : null,
      estado: 'iniciacion',
      creado_por: user?.id
    }).select().single()
    if (error) { setError(error.message); setLoading(false) }
    else router.push(`/proyectos/${data.id}`)
  }

  const puedePrecio = PUEDE_VER_COSTOS.includes(userRol as Rol)

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/proyectos" className="btn-ghost"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-2xl font-semibold text-gray-900">Nuevo proyecto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info general */}
        <div className="card">
          <div className="card-header"><h2 className="font-medium text-gray-900">Información general</h2></div>
          <div className="card-body space-y-4">
            <div className="form-grid">
              <div className="md:col-span-2">
                <label className="input-label">Título del proyecto *</label>
                <input className="input-field" value={form.titulo} onChange={e => set('titulo', e.target.value)} required />
              </div>
              <div className="md:col-span-2">
                <label className="input-label">Cliente *</label>
                <select className="select-field" value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} required>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Fecha de inicio</label>
                <input type="date" className="input-field" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Fecha de fin estimada</label>
                <input type="date" className="input-field" value={form.fecha_fin_estimada} onChange={e => set('fecha_fin_estimada', e.target.value)} />
              </div>
              {puedePrecio && (
                <div>
                  <label className="input-label">Valor bruto del proyecto ($)</label>
                  <input type="number" min="0" step="0.01" className="input-field" value={form.valor_bruto} onChange={e => set('valor_bruto', e.target.value)} placeholder="0.00" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alcance */}
        <div className="card">
          <div className="card-header"><h2 className="font-medium text-gray-900">Alcance del trabajo</h2></div>
          <div className="card-body space-y-4">
            <div>
              <label className="input-label">Descripción</label>
              <textarea className="textarea-field" rows={3} value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Breve descripción del proyecto..." />
            </div>
            <div>
              <label className="input-label">Alcance detallado</label>
              <textarea className="textarea-field" rows={5} value={form.alcance} onChange={e => set('alcance', e.target.value)} placeholder="Describe el alcance completo del trabajo..." />
            </div>
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        <div className="flex gap-3 justify-end">
          <Link href="/proyectos" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Crear proyecto'}
          </button>
        </div>
      </form>
    </div>
  )
}
