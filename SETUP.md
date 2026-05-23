# GestPro — Guía de instalación y despliegue

## 1. Configurar Supabase (gratis)

### 1.1 Crear proyecto
1. Ve a https://supabase.com y crea una cuenta
2. Crea un nuevo proyecto (anota la contraseña de la BD)
3. Espera ~2 minutos a que el proyecto se inicialice

### 1.2 Ejecutar el schema
1. En tu proyecto Supabase, ve a **SQL Editor**
2. Copia todo el contenido de `supabase_schema.sql`
3. Pégalo en el editor y haz clic en **RUN**

### 1.3 Obtener credenciales
Ve a **Settings → API** y copia:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 1.4 Configurar autenticación
Ve a **Authentication → Settings**:
- En "Email Auth" asegúrate de que esté habilitado
- En "Email confirmations" puedes DESACTIVAR la confirmación para el demo
  (Project Settings → Auth → Disable email confirmations)

---

## 2. Despliegue en Vercel (gratis)

### 2.1 Subir código a GitHub
```bash
cd proyecto-gestion
git init
git add .
git commit -m "Initial commit"
# Crear repo en github.com y conectar
git remote add origin https://github.com/TU_USUARIO/gestpro.git
git push -u origin main
```

### 2.2 Desplegar en Vercel
1. Ve a https://vercel.com y crea cuenta (gratis)
2. Haz clic en **New Project** → importa tu repo de GitHub
3. En **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
4. Haz clic en **Deploy**
5. En ~2 minutos tendrás una URL pública ✅

---

## 3. Crear el primer usuario administrador

Después del deploy, necesitas crear el primer admin:

1. Ve a tu proyecto Supabase → **Authentication → Users**
2. Haz clic en **Add user → Create new user**
3. Ingresa email y contraseña
4. Luego ve a **Table Editor → perfiles**
5. Busca el usuario recién creado y cambia el campo `rol` a `administrador`

A partir de ahí, el admin puede crear todos los demás usuarios desde la interfaz.

---

## 4. Migración a VPS (post-demo)

Cuando el cliente apruebe, puedes migrar a un servidor propio:

### Requisitos del VPS
- Ubuntu 22.04+
- Node.js 20+
- Docker (opcional)
- Nginx
- 1GB RAM mínimo

### Opción A: Self-hosted Supabase
Supabase tiene versión self-hosted con Docker Compose:
```bash
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
# Editar .env con tus valores
docker compose up -d
```
Luego ejecutas el schema en tu instancia local.

### Opción B: Mantener Supabase Cloud + solo Next.js en VPS
```bash
# En el VPS
git clone https://github.com/TU_USUARIO/gestpro.git
cd gestpro
npm install
cp .env.example .env.local
# Editar con tus variables de Supabase
npm run build
npm start
# O usar PM2 para mantenerlo activo
npm install -g pm2
pm2 start npm --name "gestpro" -- start
pm2 startup
```

### Configurar Nginx (proxy inverso)
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL con Let's Encrypt
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d tu-dominio.com
```

---

## 5. Usuarios y roles

| Rol | Descripción | Accesos |
|-----|-------------|---------|
| `administrador` | Control total | Todo + Gestión usuarios |
| `arquitecto_ingeniero` | Diseño y planificación | Clientes, Proyectos, Panel costos (ver) |
| `implementador` | Ejecución en campo | Clientes (ver), Proyectos |
| `tecnico` | Operativo | Proyectos (solo bitácora) |
| `contabilidad` | Financiero | Costos (editar), Panel costos |

---

## 6. Estructura del proyecto

```
proyecto-gestion/
├── src/
│   ├── app/
│   │   ├── (app)/            # Rutas protegidas con sidebar
│   │   │   ├── dashboard/    # Dashboard principal + costos
│   │   │   ├── clientes/     # Lista + nuevo + detalle
│   │   │   ├── proyectos/    # Lista + nuevo + detalle con tabs
│   │   │   └── usuarios/     # Gestión usuarios (solo admin)
│   │   └── auth/login/       # Página de login
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   ├── proyectos/ProyectoTabs.tsx  # Tabs Info/Recursos/Bitácora/Costos
│   │   └── usuarios/GestionUsuariosClient.tsx
│   ├── lib/supabase.ts       # Cliente Supabase (browser + server)
│   └── types/index.ts        # Tipos TypeScript + constantes
├── supabase_schema.sql       # Todo el schema de BD
├── middleware.ts              # Protección de rutas
└── .env.example              # Variables de entorno
```
