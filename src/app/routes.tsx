import { createBrowserRouter, Link, Navigate, type RouteObject } from 'react-router'
import { AppShell } from './AppShell'
import { LoginPage } from '../features/auth/LoginPage'
import { SignupPage } from '../features/auth/SignupPage'
import { RequireAuth } from '../features/auth/RequireAuth'
import { ProfilePage } from '../features/profile/ProfilePage'
import { ExercisesPage } from '../features/exercises/ExercisesPage'
import { WorkoutPage } from '../features/workouts/WorkoutPage'

function Placeholder({ title }: { title: string }) {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold text-content">{title}</h1>
      <p className="mt-2 text-content-muted">Próximamente.</p>
    </section>
  )
}

// Rutinas todavía no existe, pero el catálogo de ejercicios sí, y sin un
// enlace no habría forma de llegar a él desde la interfaz. El enlace se queda
// cuando Rutinas se construya: buscar un ejercicio es parte de armar una rutina.
function RoutinesPlaceholder() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold text-content">Rutinas</h1>
      <p className="mt-2 text-content-muted">Próximamente.</p>
      <Link
        to="/ejercicios"
        className="mt-6 inline-block rounded-lg bg-brand px-4 py-3 font-medium text-brand-content"
      >
        Ver ejercicios
      </Link>
    </section>
  )
}

// La app es una PWA instalada con `display: standalone` y sin barra de
// direcciones: si una ruta explota fuera de AppShell, forzar el cierre es la
// única salida. Este elemento de error da un camino de vuelta.
function RouteError() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold text-content">Algo salió mal</h1>
      <p className="max-w-sm text-content-muted">
        Ocurrió un error inesperado. Puedes volver al inicio.
      </p>
      <Link
        to="/"
        replace
        className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content"
      >
        Volver al inicio
      </Link>
    </main>
  )
}

// Rutas públicas, accesibles sin sesión.
const publicRoutes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/registro', element: <SignupPage /> },
]

export const routes: RouteObject[] = [
  ...publicRoutes,
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <WorkoutPage /> },
      { path: 'rutinas', element: <RoutinesPlaceholder /> },
      { path: 'ejercicios', element: <ExercisesPage /> },
      { path: 'progreso', element: <Placeholder title="Progreso" /> },
      { path: 'perfil', element: <ProfilePage /> },
    ],
  },
  // Cualquier URL fuera de las rutas conocidas cae aquí en vez del error
  // boundary por defecto de react-router, que renderiza fuera de AppShell y
  // deja a un usuario instalado (sin barra de direcciones, sin botón "atrás")
  // sin forma de escapar salvo forzar el cierre de la app.
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
