import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import { getProfile, updateProfile } from '@/lib/supabase/queries'
import { useTheme, type Theme } from '@/lib/theme'
import { clearLocal, pendingCount, syncNow } from '@/lib/offline'
import type { Units } from '@/lib/supabase/types'
import { Button, Chip, Spinner } from '@/components/ui'
import { Wordmark, Tagline } from '@/components/Wordmark'

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
]

export function Profile() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const [leaving, setLeaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    queryFn: () => getProfile(user!.id),
  })

  async function setUnits(units: Units) {
    if (!user) return
    await updateProfile(user.id, { units })
    await queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
  }

  async function chooseTheme(next: Theme) {
    setTheme(next)
    if (user) await updateProfile(user.id, { theme: next })
  }

  /**
   * Cerrar sesión borra IndexedDB, así que antes hay que subir lo pendiente.
   * Si no se puede, se avisa en vez de tirar el trabajo del usuario a la basura.
   */
  async function leave() {
    setLeaving(true)
    setWarning(null)

    const pending = await pendingCount()
    if (pending > 0) {
      const { failed } = await syncNow()
      if (failed > 0) {
        setWarning(
          `Quedan ${failed} series sin subir. Conéctate y espera un momento antes de salir, o se perderán.`,
        )
        setLeaving(false)
        return
      }
    }

    await clearLocal()
    await signOut()
  }

  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="display text-2xl">{profile?.display_name ?? 'Tu perfil'}</h1>
        <p className="text-sm text-[var(--fg-muted)]">{user?.email}</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">Tema</h2>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(({ value, label, Icon }) => (
            <Chip
              key={value}
              selected={theme === value}
              onClick={() => void chooseTheme(value)}
              className="flex items-center justify-center gap-1.5"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">Unidades</h2>
        <div className="grid grid-cols-2 gap-2">
          <Chip selected={profile?.units !== 'imperial'} onClick={() => void setUnits('metric')}>
            Kilos
          </Chip>
          <Chip selected={profile?.units === 'imperial'} onClick={() => void setUnits('imperial')}>
            Libras
          </Chip>
        </div>
      </section>

      <div className="flex-1" />

      {warning && (
        <p role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">
          {warning}
        </p>
      )}

      <Button variant="danger" size="lg" full disabled={leaving} onClick={() => void leave()}>
        {leaving ? <Spinner /> : <LogOut className="size-5" aria-hidden />}
        Cerrar sesión
      </Button>

      <footer className="flex flex-col items-center gap-2 pt-2 text-center">
        <Wordmark className="h-5 opacity-40" />
        <Tagline className="opacity-40" />
        <p className="text-xs text-[var(--fg-muted)]">
          Ejercicios de free-exercise-db, de dominio público.
        </p>
      </footer>
    </main>
  )
}
