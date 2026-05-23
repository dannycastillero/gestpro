-- ============================================================
-- SCHEMA COMPLETO - Sistema de Gestión de Proyectos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: perfiles de usuario (extiende auth.users de Supabase)
-- ============================================================
CREATE TABLE public.perfiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('administrador', 'tecnico', 'implementador', 'arquitecto_ingeniero', 'contabilidad')),
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: clientes
-- ============================================================
CREATE TABLE public.clientes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre TEXT NOT NULL,
  razon_social TEXT,
  direccion TEXT,
  telefono_principal TEXT,
  telefono_secundario TEXT,
  email TEXT,
  poc_nombre TEXT,        -- Point of Contact nombre
  poc_telefono TEXT,      -- Point of Contact teléfono
  poc_email TEXT,         -- Point of Contact email
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  creado_por UUID REFERENCES public.perfiles(id),
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: proyectos / órdenes de trabajo
-- ============================================================
CREATE TABLE public.proyectos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero_ot TEXT UNIQUE NOT NULL,   -- e.g. OT-2024-001
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE RESTRICT NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  alcance TEXT,
  estado TEXT NOT NULL DEFAULT 'iniciacion'
    CHECK (estado IN ('iniciacion', 'planificacion', 'en_ejecucion', 'remediacion_garantia', 'cerrado')),
  fecha_inicio DATE,
  fecha_fin_estimada DATE,
  fecha_fin_real DATE,
  valor_bruto NUMERIC(12,2),        -- visible para admin, contabilidad, arq/ing
  creado_por UUID REFERENCES public.perfiles(id),
  creado_en TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- Secuencia para numero_ot
CREATE SEQUENCE IF NOT EXISTS ot_seq START 1;

-- Función para generar número OT automático
CREATE OR REPLACE FUNCTION generar_numero_ot()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_ot IS NULL OR NEW.numero_ot = '' THEN
    NEW.numero_ot := 'OT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('ot_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_numero_ot
  BEFORE INSERT ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION generar_numero_ot();

-- ============================================================
-- TABLA: recursos / equipos del proyecto
-- ============================================================
CREATE TABLE public.recursos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  cantidad INTEGER DEFAULT 1,
  unidad TEXT DEFAULT 'unidad',
  tipo TEXT NOT NULL CHECK (tipo IN ('material', 'servicio', 'mano_obra', 'equipo')),
  -- Costos internos (solo admin y contabilidad lo ven en tab costos)
  costo_interno NUMERIC(12,2),
  -- Precio de venta (visible en tab recursos para todos los autorizados)
  precio_venta NUMERIC(12,2),
  tiene_costo_cliente BOOLEAN DEFAULT FALSE,  -- si genera costo al cliente
  creado_por UUID REFERENCES public.perfiles(id),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: bitácora de actualizaciones del proyecto
-- ============================================================
CREATE TABLE public.bitacora (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  usuario_id UUID REFERENCES public.perfiles(id) NOT NULL,
  contenido TEXT NOT NULL,
  tipo TEXT DEFAULT 'actualizacion' CHECK (tipo IN ('actualizacion', 'nota', 'cambio_estado', 'problema', 'resolucion')),
  estado_anterior TEXT,
  estado_nuevo TEXT,
  -- Archivos adjuntos almacenados en Supabase Storage
  archivo_url TEXT,
  archivo_nombre TEXT,
  archivo_tipo TEXT,   -- 'imagen' | 'documento'
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLA: costos del proyecto (solo contabilidad y admin)
-- ============================================================
CREATE TABLE public.costos_proyecto (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE NOT NULL,
  concepto TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('mano_obra', 'materiales', 'subcontrato', 'gastos_generales', 'otro')),
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  notas TEXT,
  registrado_por UUID REFERENCES public.perfiles(id),
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_proyectos_cliente ON public.proyectos(cliente_id);
CREATE INDEX idx_proyectos_estado ON public.proyectos(estado);
CREATE INDEX idx_bitacora_proyecto ON public.bitacora(proyecto_id);
CREATE INDEX idx_recursos_proyecto ON public.recursos(proyecto_id);
CREATE INDEX idx_costos_proyecto ON public.costos_proyecto(proyecto_id);

-- ============================================================
-- TRIGGERS: actualizado_en automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_clientes_updated BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION update_actualizado_en();
CREATE TRIGGER tg_proyectos_updated BEFORE UPDATE ON public.proyectos
  FOR EACH ROW EXECUTE FUNCTION update_actualizado_en();
CREATE TRIGGER tg_perfiles_updated BEFORE UPDATE ON public.perfiles
  FOR EACH ROW EXECUTE FUNCTION update_actualizado_en();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitacora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costos_proyecto ENABLE ROW LEVEL SECURITY;

-- Helper function: obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS TEXT AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PERFILES: todo usuario autenticado puede ver perfiles; solo admin gestiona
CREATE POLICY "perfiles_select" ON public.perfiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "perfiles_insert" ON public.perfiles FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() = 'administrador');
CREATE POLICY "perfiles_update" ON public.perfiles FOR UPDATE TO authenticated
  USING (get_user_rol() = 'administrador' OR id = auth.uid());
CREATE POLICY "perfiles_delete" ON public.perfiles FOR DELETE TO authenticated
  USING (get_user_rol() = 'administrador');

-- CLIENTES: todos los usuarios autenticados pueden ver; admin/implementador/arq crean/editan
CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero'));
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero'));
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated
  USING (get_user_rol() = 'administrador');

-- PROYECTOS: todos ven; admin/implementador/arq crean y editan
CREATE POLICY "proyectos_select" ON public.proyectos FOR SELECT TO authenticated USING (true);
CREATE POLICY "proyectos_insert" ON public.proyectos FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero'));
CREATE POLICY "proyectos_update" ON public.proyectos FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero'));
CREATE POLICY "proyectos_delete" ON public.proyectos FOR DELETE TO authenticated
  USING (get_user_rol() = 'administrador');

-- RECURSOS: todos ven (excepto costo_interno — manejado en frontend); admin/implementador/arq editan
CREATE POLICY "recursos_select" ON public.recursos FOR SELECT TO authenticated USING (true);
CREATE POLICY "recursos_insert" ON public.recursos FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero', 'contabilidad'));
CREATE POLICY "recursos_update" ON public.recursos FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('administrador', 'implementador', 'arquitecto_ingeniero', 'contabilidad'));
CREATE POLICY "recursos_delete" ON public.recursos FOR DELETE TO authenticated
  USING (get_user_rol() IN ('administrador', 'contabilidad'));

-- BITÁCORA: todos ven y crean entradas (propias); admin ve todas
CREATE POLICY "bitacora_select" ON public.bitacora FOR SELECT TO authenticated USING (true);
CREATE POLICY "bitacora_insert" ON public.bitacora FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "bitacora_update" ON public.bitacora FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'administrador');

-- COSTOS: solo admin, contabilidad y arquitecto_ingeniero
CREATE POLICY "costos_select" ON public.costos_proyecto FOR SELECT TO authenticated
  USING (get_user_rol() IN ('administrador', 'contabilidad', 'arquitecto_ingeniero'));
CREATE POLICY "costos_insert" ON public.costos_proyecto FOR INSERT TO authenticated
  WITH CHECK (get_user_rol() IN ('administrador', 'contabilidad'));
CREATE POLICY "costos_update" ON public.costos_proyecto FOR UPDATE TO authenticated
  USING (get_user_rol() IN ('administrador', 'contabilidad'));
CREATE POLICY "costos_delete" ON public.costos_proyecto FOR DELETE TO authenticated
  USING (get_user_rol() IN ('administrador', 'contabilidad'));

-- ============================================================
-- STORAGE: bucket para archivos de bitácora
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('bitacora-archivos', 'bitacora-archivos', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "archivos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bitacora-archivos');
CREATE POLICY "archivos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bitacora-archivos');
CREATE POLICY "archivos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bitacora-archivos' AND get_user_rol() = 'administrador');

-- ============================================================
-- FUNCIÓN: crear perfil automáticamente al registrar usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, email, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'rol', 'tecnico')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
