// ============================================================
// TIPOS GLOBALES DEL SISTEMA — TecnoTrack
// ============================================================

export type Rol = 'administrador' | 'tecnico' | 'implementador' | 'arquitecto_ingeniero' | 'contabilidad'
export type EstadoProyecto = 'iniciacion' | 'planificacion' | 'en_ejecucion' | 'remediacion_garantia' | 'cerrado'
export type TipoRecurso = 'material' | 'servicio' | 'mano_obra' | 'equipo'
export type TipoBitacora = 'actualizacion' | 'nota' | 'cambio_estado' | 'problema' | 'resolucion'
export type CategoriaCategoria = 'mano_obra' | 'materiales' | 'subcontrato' | 'gastos_generales' | 'otro'
export type EstadoTarea = 'not_started' | 'in_progress' | 'completed' | 'delayed'

export interface Perfil {
  id: string
  nombre: string
  email: string
  username?: string
  rol: Rol
  activo: boolean
  creado_en: string
  actualizado_en: string
}

export interface Cliente {
  id: string
  nombre: string
  razon_social?: string
  direccion?: string
  telefono_principal?: string
  telefono_secundario?: string
  email?: string
  poc_nombre?: string
  poc_telefono?: string
  poc_email?: string
  notas?: string
  activo: boolean
  creado_por?: string
  creado_en: string
  actualizado_en: string
}

export interface Proyecto {
  id: string
  numero_ot: string
  cliente_id: string
  titulo: string
  descripcion?: string
  alcance?: string
  estado: EstadoProyecto
  fecha_inicio?: string
  fecha_fin_estimada?: string
  fecha_fin_real?: string
  valor_bruto?: number
  creado_por?: string
  creado_en: string
  actualizado_en: string
  cliente?: Cliente
  creador?: Perfil
}

export interface Recurso {
  id: string
  proyecto_id: string
  nombre: string
  descripcion?: string
  cantidad: number
  unidad: string
  tipo: TipoRecurso
  costo_interno?: number
  precio_venta?: number
  tiene_costo_cliente: boolean
  creado_por?: string
  creado_en: string
  creador?: Perfil
}

export interface BitacoraEntrada {
  id: string
  proyecto_id: string
  usuario_id: string
  contenido: string
  tipo: TipoBitacora
  estado_anterior?: string
  estado_nuevo?: string
  archivo_url?: string
  archivo_nombre?: string
  archivo_tipo?: string
  creado_en: string
  usuario?: Perfil
}

export interface CostoProyecto {
  id: string
  proyecto_id: string
  concepto: string
  categoria?: CategoriaCategoria
  monto: number
  fecha: string
  notas?: string
  registrado_por?: string
  creado_en: string
  registrador?: Perfil
}

export interface Tarea {
  id: string
  proyecto_id: string
  fase: string | null         // phase/group name (null = ungrouped)
  padre_id: string | null     // parent task id for sub-tasks
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  duracion: number            // calculated days
  responsable_id: string | null
  estado: EstadoTarea
  porcentaje: number          // 0-100
  orden: number
  creado_en: string
  responsable?: Perfil
  subtareas?: Tarea[]
}

// ── Labels & Colors ──────────────────────────────────────────
export const ESTADO_LABELS: Record<EstadoProyecto, string> = {
  iniciacion: 'Iniciación',
  planificacion: 'Planificación',
  en_ejecucion: 'En ejecución',
  remediacion_garantia: 'Remediación / Garantía',
  cerrado: 'Cerrado',
}

export const ESTADO_COLORS: Record<EstadoProyecto, string> = {
  iniciacion: 'bg-slate-100 text-slate-700',
  planificacion: 'bg-blue-100 text-blue-700',
  en_ejecucion: 'bg-emerald-100 text-emerald-700',
  remediacion_garantia: 'bg-amber-100 text-amber-700',
  cerrado: 'bg-gray-200 text-gray-600',
}

export const ROL_LABELS: Record<Rol, string> = {
  administrador: 'Administrador',
  tecnico: 'Técnico',
  implementador: 'Implementador',
  arquitecto_ingeniero: 'Arq. / Ingeniero',
  contabilidad: 'Contabilidad',
}

export const TIPO_RECURSO_LABELS: Record<TipoRecurso, string> = {
  material: 'Material',
  servicio: 'Servicio',
  mano_obra: 'Mano de obra',
  equipo: 'Equipo',
}

export const CATEGORIA_COSTO_LABELS: Record<CategoriaCategoria, string> = {
  mano_obra: 'Mano de obra',
  materiales: 'Materiales',
  subcontrato: 'Subcontrato',
  gastos_generales: 'Gastos generales',
  otro: 'Otro',
}

export const ESTADO_TAREA_LABELS: Record<EstadoTarea, string> = {
  not_started: 'No iniciado',
  in_progress: 'En progreso',
  completed: 'Completado',
  delayed: 'Retrasado',
}

export const ESTADO_TAREA_COLORS: Record<EstadoTarea, string> = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  delayed: 'bg-red-100 text-red-700',
}

export const ESTADO_TAREA_BAR: Record<EstadoTarea, string> = {
  not_started: 'bg-gray-300',
  in_progress: 'bg-blue-500',
  completed: 'bg-emerald-500',
  delayed: 'bg-red-500',
}

// ── Permissions ───────────────────────────────────────────────
export const PUEDE_VER_COSTOS: Rol[] = ['administrador', 'contabilidad', 'arquitecto_ingeniero']
export const PUEDE_EDITAR_COSTOS: Rol[] = ['administrador', 'contabilidad']
export const PUEDE_GESTIONAR_USUARIOS: Rol[] = ['administrador']
export const PUEDE_CREAR_PROYECTOS: Rol[] = ['administrador', 'implementador', 'arquitecto_ingeniero']
export const PUEDE_CREAR_CLIENTES: Rol[] = ['administrador', 'implementador', 'arquitecto_ingeniero']

// WBS tab visible when project is past Iniciación
export const ESTADOS_CON_WBS: EstadoProyecto[] = ['planificacion', 'en_ejecucion', 'remediacion_garantia', 'cerrado']
