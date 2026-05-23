'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'

export default function NuevoClientePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nombre: '', razon_social: '', direccion: '',
    telefono_principal: '', telefono_secundario: '', email: '',
    poc_nombre: '', poc_telefono: '', poc_email: '', notas: ''
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('clientes').insert({
      ...form,
      creado_por: user?.id
    })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/clientes')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clientes" className="btn-ghost">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Nuevo cliente</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <div className="card">
          <div className="card-header"><h2 className="font-medium text-gray-900">Datos generales</h2></div>
          <div className="card-body">
            <div className="form-grid">
              <div>
                <label className="input-label">Nombre *</label>
                <input className="input-field" value={form.nombre} onChange={e => set('nombre', e.target.value)} required />
              </div>
              <div>
                <label className="input-label">Razón social</label>
                <input className="input-field" value={form.razon_social} onChange={e => set('razon_social', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="input-label">Dirección</label>
                <input className="input-field" value={form.direccion} onChange={e => set('direccion', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Teléfono principal</label>
                <input className="input-field" value={form.telefono_principal} onChange={e => set('telefono_principal', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Teléfono secundario</label>
                <input className="input-field" value={form.telefono_secundario} onChange={e => set('telefono_secundario', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input type="email" className="input-field" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Punto de contacto */}
        <div className="card">
          <div className="card-header"><h2 className="font-medium text-gray-900">Punto de contacto (POC)</h2></div>
          <div className="card-body">
            <div className="form-grid">
              <div>
                <label className="input-label">Nombre del contacto</label>
                <input className="input-field" value={form.poc_nombre} onChange={e => set('poc_nombre', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Teléfono del contacto</label>
                <input className="input-field" value={form.poc_telefono} onChange={e => set('poc_telefono', e.target.value)} />
              </div>
              <div>
                <label className="input-label">Email del contacto</label>
                <input type="email" className="input-field" value={form.poc_email} onChange={e => set('poc_email', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="card">
          <div className="card-header"><h2 className="font-medium text-gray-900">Notas adicionales</h2></div>
          <div className="card-body">
            <textarea className="textarea-field" rows={3} value={form.notas} onChange={e => set('notas', e.target.value)} />
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        <div className="flex gap-3 justify-end">
          <Link href="/clientes" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}
