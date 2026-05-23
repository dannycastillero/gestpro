import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { UserCog } from 'lucide-react'
import { ROL_LABELS } from '@/types'
import GestionUsuariosClient from '@/components/usuarios/GestionUsuariosClient'

export default async function UsuariosPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'administrador') redirect('/dashboard')

  const { data: usuarios } = await supabase
    .from('perfiles')
    .select('*')
    .order('nombre')

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Gestión de usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Administra los accesos al sistema</p>
        </div>
      </div>
      <GestionUsuariosClient usuarios={usuarios || []} adminId={user.id} />
    </div>
  )
}
