import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '@/lib/supabase/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { SetupNeeded } from '@/routes/SetupNeeded'
import { RequireAuth } from '@/components/RequireAuth'
import { BottomNav } from '@/components/BottomNav'
import { Auth } from '@/routes/Auth'
import { Onboarding } from '@/routes/Onboarding'
import { Today } from '@/routes/Today'
import { Session } from '@/routes/Session'
import { PlanView } from '@/routes/PlanView'
import { Profile } from '@/routes/Profile'
import { Spinner } from '@/components/ui'

// Progreso arrastra la librería de gráficas, que es lo más pesado de la app y
// solo hace falta en esa pantalla. Se carga cuando se entra, no antes.
const Progress = lazy(() =>
  import('@/routes/Progress').then((m) => ({ default: m.Progress })),
)

/** La sesión activa y el wizard ocupan toda la pantalla: sin navegación abajo. */
const FULLSCREEN = ['/sesion/', '/empezar', '/entrar']

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const bare = FULLSCREEN.some((p) => pathname.startsWith(p))

  return (
    <div className="flex min-h-dvh flex-col">
      {children}
      {!bare && <BottomNav />}
    </div>
  )
}

export function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />

  return (
    <AuthProvider>
      <Shell>
        <Routes>
          <Route path="/entrar" element={<Auth />} />

          <Route
            path="/empezar"
            element={
              <RequireAuth>
                <Onboarding />
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Today />
              </RequireAuth>
            }
          />
          <Route
            path="/sesion/:programDayId"
            element={
              <RequireAuth>
                <Session />
              </RequireAuth>
            }
          />
          <Route
            path="/plan"
            element={
              <RequireAuth>
                <PlanView />
              </RequireAuth>
            }
          />
          <Route
            path="/progreso"
            element={
              <RequireAuth>
                <Suspense
                  fallback={
                    <div className="grid flex-1 place-items-center">
                      <Spinner className="size-8" />
                    </div>
                  }
                >
                  <Progress />
                </Suspense>
              </RequireAuth>
            }
          />
          <Route
            path="/perfil"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
        </Routes>
      </Shell>
    </AuthProvider>
  )
}
