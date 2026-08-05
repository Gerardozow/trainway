import { NavLink } from 'react-router'
import { CalendarDays, Dumbbell, TrendingUp, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/', label: 'Hoy', Icon: Dumbbell, end: true },
  { to: '/plan', label: 'Plan', Icon: CalendarDays, end: false },
  { to: '/progreso', label: 'Progreso', Icon: TrendingUp, end: false },
  { to: '/perfil', label: 'Perfil', Icon: User, end: false },
]

export function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-10 border-t border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-bold',
                  isActive ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} aria-hidden />
                  <span className={cn(isActive && 'text-volt-ink')}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
