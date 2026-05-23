'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard, FolderKanban, Building2,
  UserCog, LogOut, Layers, Menu, X, DollarSign
} from 'lucide-react'
import { Perfil, ROL_LABELS, PUEDE_VER_COSTOS, PUEDE_GESTIONAR_USUARIOS } from '@/types'
import { useState } from 'react'
import clsx from 'clsx'

interface SidebarProps { perfil: Perfil }

export default function Sidebar({ perfil }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/clientes', icon: Building2, label: 'Clientes' },
    { href: '/proyectos', icon: FolderKanban, label: 'Proyectos' },
    ...(PUEDE_VER_COSTOS.includes(perfil.rol) ? [
      { href: '/dashboard/costos', icon: DollarSign, label: 'Panel de costos' }
    ] : []),
    ...(PUEDE_GESTIONAR_USUARIOS.includes(perfil.rol) ? [
      { href: '/usuarios', icon: UserCog, label: 'Usuarios' }
    ] : []),
  ]

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm leading-none block">TecnoTrack</span>
            <span className="text-xs text-gray-400 leading-none">ITCOMSA / TECNOAMBIENTES</span>
          </div>
        </div>
        {/* Close button - mobile only */}
        <button onClick={() => setOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2.5 rounded-lg bg-gray-50 mb-2">
          <p className="text-sm font-medium text-gray-900 truncate">{perfil.nombre}</p>
          <p className="text-xs text-gray-500">{ROL_LABELS[perfil.rol]}</p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">TecnoTrack</span>
        </div>
        <button onClick={() => setOpen(true)} className="text-gray-600 hover:text-gray-900">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={clsx(
        'md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col shadow-xl transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-full">
        <SidebarContent />
      </aside>
    </>
  )
}
