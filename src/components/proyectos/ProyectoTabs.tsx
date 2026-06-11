'use client'

import { useState, useEffect } from 'react'
import TabWBS from '@/components/proyectos/TabWBS'
import TabOrdenesTrabajo from '@/components/proyectos/TabOrdenesTrabajo'
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
    { id: 'ordenes', label: 'Órdenes de Trabajo', icon: ClipboardList },
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
      {tab === 'ordenes' && (
        <TabOrdenesTrabajo proyectoId={proyecto.id} userRol={perfil?.rol ?? ''} />
      )}
    </div>
  )
}

