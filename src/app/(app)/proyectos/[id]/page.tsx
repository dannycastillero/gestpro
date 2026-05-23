import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit } from 'lucide-react'
import { ESTADO_LABELS, ESTADO_COLORS, EstadoProyecto, PUEDE_VER_COSTOS, PUEDE_CREAR_PROYECTOS } from '@/types'
import ProyectoTabs from '@/components/proyectos/ProyectoTabs'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Roles that can edit WBS tasks (broader than project creation)
const PUEDE_EDITAR_WBS = ['administrador', 'implementador', 'arquitecto_ingeniero', 'tecnico']

export default async function ProyectoDetailPage({ params, searchParams }: {
  params: { id: string }
  searchParams: { tab?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single()
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('*, cliente:clientes(*), creador:perfiles!creado_por(nombre)')
    .eq('id', params.id)
    .single()

  if (!proyecto) notFound()

  const puedePrecio = perfil && PUEDE_VER_COSTOS.includes(perfil.rol)
  const puedeEditar = perfil && PUEDE_CREAR_PROYECTOS.includes(perfil.rol)
  const puedeEditarWBS = perfil && PUEDE_EDITAR_WBS.includes(perfil.rol)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Link href="/proyectos" className="btn-ghost mt-1"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <span className="font-mono text-sm text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                {proyecto.numero_ot}
              </span>
              <span className={`badge ${ESTADO_COLORS[proyecto.estado as EstadoProyecto]}`}>
                {ESTADO_LABELS[proyecto.estado as EstadoProyecto]}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">{proyecto.titulo}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Cliente: <span className="font-medium text-gray-700">{proyecto.cliente?.nombre}</span>
              {proyecto.creado_en && (
                <> · Creado el {format(new Date(proyecto.creado_en), "d 'de' MMMM yyyy", { locale: es })}</>
              )}
            </p>
          </div>
        </div>
        {puedeEditar && (
          <Link href={`/proyectos/${proyecto.id}/editar`} className="btn-secondary hidden sm:inline-flex">
            <Edit className="w-4 h-4" /> Editar
          </Link>
        )}
      </div>

      {/* Tabs */}
      <ProyectoTabs
        proyecto={proyecto}
        perfil={perfil}
        activeTab={searchParams.tab || 'info'}
        puedePrecio={!!puedePrecio}
        puedeEditar={!!puedeEditar}
        puedeEditarWBS={!!puedeEditarWBS}
      />
    </div>
  )
}
