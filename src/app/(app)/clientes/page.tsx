import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Building2, Phone, Mail, Search } from 'lucide-react'
import { PUEDE_CREAR_CLIENTES } from '@/types'

export default async function ClientesPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  const q = searchParams.q || ''

  let query = supabase.from('clientes').select('*').eq('activo', true).order('nombre')
  if (q) query = query.ilike('nombre', `%${q}%`)
  const { data: clientes } = await query

  const puedeCrear = perfil && PUEDE_CREAR_CLIENTES.includes(perfil.rol)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">{clientes?.length || 0} cliente(s) registrado(s)</p>
        </div>
        {puedeCrear && (
          <Link href="/clientes/nuevo" className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo cliente
          </Link>
        )}
      </div>

      {/* Search */}
      <form className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre..."
          className="input-field pl-9 max-w-sm"
        />
      </form>

      {/* Grid de clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(clientes || []).map((c: any) => (
          <Link key={c.id} href={`/clientes/${c.id}`}
            className="card p-5 hover:shadow-md transition-shadow duration-150 block">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-brand-600" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{c.nombre}</p>
                {c.razon_social && <p className="text-xs text-gray-500 truncate">{c.razon_social}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              {c.telefono_principal && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone className="w-3.5 h-3.5" /> {c.telefono_principal}
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                  <Mail className="w-3.5 h-3.5" /> {c.email}
                </div>
              )}
              {c.poc_nombre && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">POC:</span> {c.poc_nombre}
                </div>
              )}
            </div>
          </Link>
        ))}

        {(!clientes || clientes.length === 0) && (
          <div className="col-span-3 empty-state">
            <Building2 className="w-10 h-10 mb-3 text-gray-300" />
            <p className="font-medium text-gray-500">No hay clientes registrados</p>
            {puedeCrear && (
              <Link href="/clientes/nuevo" className="btn-primary mt-4">
                <Plus className="w-4 h-4" /> Crear primer cliente
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
