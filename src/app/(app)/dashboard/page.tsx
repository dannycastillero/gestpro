import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ESTADO_LABELS, ESTADO_COLORS, EstadoProyecto } from '@/types'
import { FolderKanban, Building2, CheckCircle, Clock, AlertCircle, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [
    { count: totalClientes },
    { data: proyectos },
    { count: totalProyectos },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('activo', true),
    supabase.from('proyectos').select('*, cliente:clientes(nombre)').order('creado_en', { ascending: false }).limit(8),
    supabase.from('proyectos').select('*', { count: 'exact', head: true }),
  ])

  const estadoCount = (proyectos || []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.estado] = (acc[p.estado] || 0) + 1
    return acc
  }, {})

  const stats = [
    { label: 'Proyectos totales', value: totalProyectos || 0, icon: FolderKanban, color: 'bg-brand-50 text-brand-600' },
    { label: 'Clientes activos', value: totalClientes || 0, icon: Building2, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'En ejecución', value: estadoCount['en_ejecucion'] || 0, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Cerrados', value: estadoCount['cerrado'] || 0, icon: CheckCircle, color: 'bg-gray-50 text-gray-500' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(stat => (
          <div key={stat.label} className="card p-5">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Proyectos recientes */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Proyectos recientes</h2>
          <Link href="/proyectos" className="btn-ghost text-brand-600">
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>N° OT</th>
                <th>Proyecto</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Fecha inicio</th>
              </tr>
            </thead>
            <tbody>
              {(proyectos || []).map((p: any) => (
                <tr key={p.id} className="cursor-pointer">
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
                  <td className="text-gray-600">{p.cliente?.nombre || '—'}</td>
                  <td>
                    <span className={`badge ${ESTADO_COLORS[p.estado as EstadoProyecto]}`}>
                      {ESTADO_LABELS[p.estado as EstadoProyecto]}
                    </span>
                  </td>
                  <td className="text-gray-500 text-xs">
                    {p.fecha_inicio ? format(new Date(p.fecha_inicio), 'dd/MM/yyyy') : '—'}
                  </td>
                </tr>
              ))}
              {(!proyectos || proyectos.length === 0) && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    No hay proyectos registrados aún
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
