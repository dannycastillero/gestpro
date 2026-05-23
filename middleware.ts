import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from './src/lib/supabase'

export async function middleware(request: NextRequest) {
  const { supabase, supabaseResponse } = createMiddlewareClient(request)
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Rutas públicas
  if (path.startsWith('/auth')) {
    if (user) return NextResponse.redirect(new URL('/dashboard', request.url))
    return supabaseResponse
  }

  // Proteger todas las demás rutas
  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Proteger ruta de usuarios: solo administrador
  if (path.startsWith('/usuarios')) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (perfil?.rol !== 'administrador') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
