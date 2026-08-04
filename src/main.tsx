import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './features/theme/ThemeProvider'
import { AuthProvider } from './features/auth/AuthProvider'
import { useAuth } from './features/auth/useAuth'
import { fetchProfile } from './features/profile/profile-repository'
import { UsernameOnboarding } from './features/profile/UsernameOnboarding'
import { router } from './app/routes'
import './index.css'

const queryClient = new QueryClient()

function Gate() {
  const { session, loading } = useAuth()
  const [needsUsername, setNeedsUsername] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) {
      setNeedsUsername(null)
      return
    }
    fetchProfile(session.user.id)
      .then((profile) => setNeedsUsername(!profile?.username))
      .catch(() => setNeedsUsername(false))
  }, [session])

  if (!loading && session && needsUsername === true) {
    return (
      <UsernameOnboarding
        userId={session.user.id}
        onDone={() => setNeedsUsername(false)}
      />
    )
  }

  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
