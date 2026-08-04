import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from './AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { signOut } from '../features/auth/auth-repository'

function Placeholder({ title }: { title: string }) {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold text-content">{title}</h1>
      <p className="mt-2 text-content-muted">Próximamente.</p>
    </section>
  )
}

function ProfilePage() {
  return (
    <section className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold text-content">Perfil</h1>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-content-muted">Tema</span>
        <ThemeToggle />
      </div>
      <button
        type="button"
        onClick={() => signOut()}
        className="self-start rounded-lg border border-border px-4 py-2 text-content"
      >
        Cerrar sesión
      </button>
    </section>
  )
}

// Rutas públicas, accesibles sin sesión. Un plan posterior añade `/registro`
// junto a `/login`; basta con agregar otra entrada a este arreglo.
const publicRoutes: RouteObject[] = [{ path: '/login', element: <LoginPage /> }]

export const router = createBrowserRouter([
  ...publicRoutes,
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Placeholder title="Entrenar" /> },
      { path: 'rutinas', element: <Placeholder title="Rutinas" /> },
      { path: 'progreso', element: <Placeholder title="Progreso" /> },
      { path: 'perfil', element: <ProfilePage /> },
    ],
  },
])
