import { NavLink, Outlet } from 'react-router'

const DESTINATIONS = [
  { to: '/', label: 'Entrenar', end: true },
  { to: '/rutinas', label: 'Rutinas', end: false },
  { to: '/progreso', label: 'Progreso', end: false },
  { to: '/perfil', label: 'Perfil', end: false },
]

export function AppShell() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </div>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 border-t border-border bg-surface-raised"
      >
        <ul className="mx-auto flex max-w-lg">
          {DESTINATIONS.map((destination) => (
            <li key={destination.to} className="flex-1">
              <NavLink
                to={destination.to}
                end={destination.end}
                className={({ isActive }) =>
                  isActive
                    ? 'block py-3 text-center text-sm font-medium text-brand'
                    : 'block py-3 text-center text-sm font-medium text-content-muted'
                }
              >
                {destination.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
