import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, FolderKanban } from 'lucide-react'
import { ESTADO_LABELS, ESTADO_COLORS, EstadoProyecto, PUEDE_CREAR_PROYECTOS } from '@/types'
import { format } from 'date-fns'
import clsx from 'clsx'

const ESTADOS: EstadoProyecto[] = ['iniciacion', 'planificacion', 'en_ejecucion', 'remediacion_garantia', 'cerrado']

export default async function ProyectosPage({ searchParams }: { searchParams: { estado?: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  const estadoFiltro = searchParams.estado as EstadoProyecto | undefined

  let query = supabase.from('proyectos')
    .select('*, cliente:clientes(nombre)')
    .order('creado_en', { ascending: false })
  if (estadoFiltro) query = query.eq('estado', estadoFiltro)
  const { data: proyectos } = await query

  const puedeCrear = perfil && PUEDE_CREAR_PROYECTOS.includes(perfil.rol)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Proyectos</h1>
          <p className="text-sm text-gray-500 mt-1">{proyectos?.length || 0} proyecto(s)</p>
        </div>
        {puedeCrear && (
          <Link href="/proyectos/nuevo" className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo proyecto
          </Link>
        )}
      </div>

      {/* Filtro por estado */}
      <div className="flex gap-2 flex-wrap mb-5">
        <Link
          href="/proyectos"
          className={clsx(
            'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
            !estadoFiltro ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          )}
        >
          Todos
        </Link>
        {ESTADOS.map(e => (
          <Link
            key={e}
            href={`/proyectos?estado=${e}`}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              estadoFiltro === e ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            {ESTADO_LABELS[e]}
          </Link>
        ))}
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>N° OT</th>
                <th>Título</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin estimado</th>
              </tr>
            </thead>
            <tbody>
              {(proyectos || []).map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/proyectos/${p.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                      {p.numero_ot}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/proyectos/${p.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                      {p.titulo}
                    </Link>
                  </td>
                  <td className="text-gray-600 text-sm">{p.cliente?.nombre || '—'}</td>
                  <td>
                    <span className={`badge ${ESTADO_COLORS[p.estado as EstadoProyecto]}`}>
                      {ESTADO_LABELS[p.estado as EstadoProyecto]}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">
                    {p.fecha_inicio ? format(new Date(p.fecha_inicio), 'dd/MM/yy') : '—'}
                  </td>
                  <td className="text-gray-500 text-xs">
                    {p.fecha_fin_estimada ? format(new Date(p.fecha_fin_estimada), 'dd/MM/yy') : '—'}
                  </td>
                </tr>
              ))}
              {(!proyectos || proyectos.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    No hay proyectos {estadoFiltro ? `con estado "${ESTADO_LABELS[estadoFiltro]}"` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
