import { Navigate, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/supabase/useAuth'
import { Spinner } from '@/components/ui'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (!user) return <Navigate to="/entrar" state={{ from: location.pathname }} replace />

  return <>{children}</>
}
