import { NavLink, Outlet } from 'react-router'

const DESTINATIONS = [
  { to: '/', label: 'Entrenar', end: true, Icon: DumbbellIcon },
  { to: '/rutinas', label: 'Rutinas', end: false, Icon: ListIcon },
  { to: '/progreso', label: 'Progreso', end: false, Icon: ChartIcon },
  { to: '/perfil', label: 'Perfil', end: false, Icon: UserIcon },
]

export function AppShell() {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <div className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </div>

      <nav
        aria-label="Navegación principal"
        // El padding inferior respeta la zona de gestos del teléfono: sin él,
        // en un iPhone la barra queda debajo del indicador de inicio.
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto flex max-w-lg">
          {DESTINATIONS.map(({ to, label, end, Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-2.5 text-[0.66rem] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    isActive ? 'text-content' : 'text-content-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      // El destino activo se marca con una pastilla detrás del
                      // icono, no solo con color: el color por sí solo pide
                      // poder distinguirlo, y aquí hay una forma que lo dice.
                      className={`rounded-lg px-4 py-1 transition-colors ${
                        isActive ? 'bg-brand text-brand-content' : ''
                      }`}
                    >
                      <Icon />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

const ICON = 'h-5 w-5'

function DumbbellIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 6.5v11M4 9v5M17.5 6.5v11M20 9v5M6.5 12h11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20V10M10 20V4M16 20v-7M22 20H2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg className={ICON} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
