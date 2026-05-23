import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ESTADO_LABELS, ESTADO_COLORS, EstadoProyecto, PUEDE_VER_COSTOS } from '@/types'
import { ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

export default async function DashboardCostosPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (!perfil || !PUEDE_VER_COSTOS.includes(perfil.rol)) redirect('/dashboard')

  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('*, cliente:clientes(nombre)')
    .neq('estado', 'cerrado')
    .order('creado_en', { ascending: false })

  // Para cada proyecto obtener costos y recursos
  const proyectosConDatos = await Promise.all((proyectos || []).map(async (p: any) => {
    const [{ data: costos }, { data: recursos }] = await Promise.all([
      supabase.from('costos_proyecto').select('monto').eq('proyecto_id', p.id),
      supabase.from('recursos').select('costo_interno, cantidad').eq('proyecto_id', p.id)
    ])
    const totalCostos = (costos || []).reduce((s: number, c: any) => s + c.monto, 0)
    const costoRecursos = (recursos || []).reduce((s: number, r: any) => s + (r.costo_interno || 0) * r.cantidad, 0)
    const costoTotal = totalCostos + costoRecursos
    const margen = p.valor_bruto != null ? p.valor_bruto - costoTotal : null
    return { ...p, costoTotal, margen }
  }))

  const totalValorBruto = proyectosConDatos.reduce((s, p) => s + (p.valor_bruto || 0), 0)
  const totalCostos = proyectosConDatos.reduce((s, p) => s + p.costoTotal, 0)
  const totalMargen = totalValorBruto - totalCostos

  const fmt = (n: number) => `$${n.toLocaleString('es', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Panel de costos</h1>
        <p className="text-sm text-gray-500 mt-1">Proyectos activos — vista financiera</p>
      </div>

      {/* KPIs globales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-2">Total valor bruto (proyectos activos)</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(totalValorBruto)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-2">Total costos estimados</p>
          <p className="text-2xl font-bold text-red-600">{fmt(totalCostos)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-2">Margen estimado total</p>
          <p className={`text-2xl font-bold ${totalMargen >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(totalMargen)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Detalle por proyecto</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>N° OT</th>
                <th>Proyecto</th>
                <th>Estado</th>
                <th>Valor bruto</th>
                <th>Costo total</th>
                <th>Margen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {proyectosConDatos.map((p: any) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-brand-600">{p.numero_ot}</td>
                  <td>
                    <p className="font-medium text-gray-900">{p.titulo}</p>
                    <p className="text-xs text-gray-500">{p.cliente?.nombre}</p>
                  </td>
                  <td>
                    <span className={`badge ${ESTADO_COLORS[p.estado as EstadoProyecto]}`}>
                      {ESTADO_LABELS[p.estado as EstadoProyecto]}
                    </span>
                  </td>
                  <td className="font-medium">{p.valor_bruto != null ? fmt(p.valor_bruto) : <span className="text-gray-400">—</span>}</td>
                  <td className="text-red-600">{fmt(p.costoTotal)}</td>
                  <td className={p.margen == null ? 'text-gray-400' : p.margen >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {p.margen != null ? fmt(p.margen) : '—'}
                  </td>
                  <td>
                    <Link href={`/proyectos/${p.id}?tab=costos`} className="btn-ghost text-xs">
                      Ver costos <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
              {proyectosConDatos.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin proyectos activos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
