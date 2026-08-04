import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { fetchProfile } from '../features/profile/profile-repository'
import { UsernameOnboarding } from '../features/profile/UsernameOnboarding'
import { router } from './routes'

// Decide entre tres pantallas según el estado de sesión y de perfil: nada
// (mientras se resuelve la sesión inicial), onboarding de username (sesión
// sin perfil completo) o la app (router protegido por RequireAuth).
export function Gate() {
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
