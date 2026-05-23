'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Perfil, Rol, ROL_LABELS } from '@/types'
import { Plus, Edit2, Check, X, UserCheck, UserX } from 'lucide-react'
import clsx from 'clsx'

interface Props { usuarios: Perfil[]; adminId: string }

export default function GestionUsuariosClient({ usuarios: init, adminId }: Props) {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Perfil[]>(init)
  const [showNew, setShowNew] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newForm, setNewForm] = useState({
    nombre: '', username: '', email: '', password: '', rol: 'tecnico' as Rol
  })
  const [editRol, setEditRol] = useState<Rol>('tecnico')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Check username is unique
    const { data: existing } = await supabase
      .from('perfiles')
      .select('id')
      .eq('username', newForm.username.toLowerCase())
      .single()
    if (existing) {
      setError('Ese nombre de usuario ya existe. Elige otro.')
      setLoading(false)
      return
    }

    const { data, error: authErr } = await supabase.auth.signUp({
      email: newForm.email,
      password: newForm.password,
      options: { data: { nombre: newForm.nombre, rol: newForm.rol } }
    })
    if (authErr) { setError(authErr.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('perfiles').upsert({
        id: data.user.id,
        nombre: newForm.nombre,
        username: newForm.username.toLowerCase(),
        email: newForm.email,
        rol: newForm.rol,
        activo: true,
      })
    }
    setShowNew(false)
    setNewForm({ nombre: '', username: '', email: '', password: '', rol: 'tecnico' })
    loadUsuarios()
    setLoading(false)
  }

  async function handleUpdateRol(id: string) {
    await supabase.from('perfiles').update({ rol: editRol }).eq('id', id)
    setEditId(null)
    loadUsuarios()
  }

  async function toggleActivo(u: Perfil) {
    if (u.id === adminId) return
    await supabase.from('perfiles').update({ activo: !u.activo }).eq('id', u.id)
    loadUsuarios()
  }

  async function loadUsuarios() {
    const { data } = await supabase.from('perfiles').select('*').order('nombre')
    setUsuarios(data || [])
  }

  const ROLES: Rol[] = ['administrador', 'implementador', 'arquitecto_ingeniero', 'tecnico', 'contabilidad']

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(!showNew)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Crear usuario
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-medium text-gray-900 mb-4">Nuevo usuario</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newForm.nombre} onChange={e => setNewForm(f => ({...f, nombre: e.target.value}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de usuario * (para el login)</label>
                <input className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ej: juan.perez"
                  value={newForm.username} onChange={e => setNewForm(f => ({...f, username: e.target.value.toLowerCase().replace(/\s/g,'')}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email * (solo para registro interno)</label>
                <input type="email" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newForm.email} onChange={e => setNewForm(f => ({...f, email: e.target.value}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña temporal * (mín. 8 caracteres)</label>
                <input type="password" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newForm.password} onChange={e => setNewForm(f => ({...f, password: e.target.value}))} required minLength={8} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newForm.rol} onChange={e => setNewForm(f => ({...f, rol: e.target.value as Rol}))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
              ⚠️ El usuario ingresará con su <strong>nombre de usuario</strong> (no con el email). El email es solo para el registro en Supabase Auth.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowNew(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Creando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table — desktop */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, i) => (
              <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-4 py-3 font-medium text-gray-900">{u.nombre}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{(u as any).username || <span className="text-gray-300 italic">sin usuario</span>}</td>
                <td className="px-4 py-3">
                  {editId === u.id ? (
                    <div className="flex items-center gap-1">
                      <select className="border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editRol} onChange={e => setEditRol(e.target.value as Rol)}>
                        {ROLES.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                      </select>
                      <button onClick={() => handleUpdateRol(u.id)} className="text-green-600 hover:text-green-700 p-0.5"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="text-red-400 hover:text-red-600 p-0.5"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-700">{ROL_LABELS[u.rol]}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditId(u.id); setEditRol(u.rol) }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Editar rol">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {u.id !== adminId && (
                      <button onClick={() => toggleActivo(u)}
                        className={`p-1.5 rounded hover:bg-gray-100 ${u.activo ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}`}
                        title={u.activo ? 'Desactivar' : 'Activar'}>
                        {u.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {usuarios.map(u => (
          <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-gray-900">{u.nombre}</p>
                <p className="text-xs text-gray-500 font-mono">{(u as any).username || 'sin usuario'}</p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {u.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{ROL_LABELS[u.rol]}</span>
              <div className="flex gap-1">
                <button onClick={() => { setEditId(editId === u.id ? null : u.id); setEditRol(u.rol) }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                  <Edit2 className="w-4 h-4" />
                </button>
                {u.id !== adminId && (
                  <button onClick={() => toggleActivo(u)}
                    className={`p-1.5 rounded hover:bg-gray-100 ${u.activo ? 'text-red-400' : 'text-green-500'}`}>
                    {u.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
            {editId === u.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                <select className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={editRol} onChange={e => setEditRol(e.target.value as Rol)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROL_LABELS[r]}</option>)}
                </select>
                <button onClick={() => handleUpdateRol(u.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">Guardar</button>
                <button onClick={() => setEditId(null)} className="px-3 py-1.5 border border-gray-200 rounded text-sm">Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Solo el administrador puede crear, editar roles y activar/desactivar usuarios.
      </p>
    </div>
  )
}
