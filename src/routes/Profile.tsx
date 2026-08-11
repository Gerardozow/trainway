import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, LogOut, Monitor, Moon, Sun, Vibrate, Volume2, VolumeX } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import { getLatestIntake, getProfile, updateProfile } from '@/lib/supabase/queries'
import { useTheme, type Theme } from '@/lib/theme'
import { clearLocal, pendingCount, syncNow } from '@/lib/offline'
import { REST_MAX, REST_MIN, REST_STEP, useSettings } from '@/lib/settings'
import { EQUIPMENT_ES } from '@/lib/catalog'
import { GOALS } from '@/lib/intakeOptions'
import { formatDuration } from '@/lib/utils'
import type { Units } from '@/lib/supabase/types'
import { Button, Chip, Spinner, Stepper } from '@/components/ui'
import { InstallCard } from '@/components/InstallCard'
import { Wordmark, Tagline } from '@/components/Wordmark'

/** 90 s: el punto medio de lo que prescribe el plan, y un sitio del que subir o bajar. */
const DEFAULT_REST = 90

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
]

export function Profile() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const [settings, updateSettings] = useSettings()
  const [leaving, setLeaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    queryFn: () => getProfile(user!.id),
  })

  const { data: intake } = useQuery({
    queryKey: ['intake', user?.id],
    enabled: Boolean(user),
    queryFn: () => getLatestIntake(user!.id),
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

      {/* Lo que respondiste en el cuestionario, resumido y editable. Es lo que
          decide qué ejercicios se ofrecen; tenerlo escondido lo dejaba obsoleto. */}
      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">Tu entrenamiento</h2>
        <Link
          to="/preferencias"
          className="press strip flex items-center gap-3 p-4 text-left active:bg-[var(--surface-2)]"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-bold">
              {GOALS.find((g) => g.value === intake?.goal)?.label ?? 'Sin cuestionario'}
            </span>
            <span className="text-sm text-[var(--fg-muted)]">
              {intake
                ? `${intake.days_per_week} días · ${intake.session_minutes} min · ${
                    intake.equipment.map((e) => EQUIPMENT_ES[e] ?? e).join(', ') || 'sin equipo'
                  }`
                : 'Responde para armar tu plan'}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-[var(--fg-muted)]" aria-hidden />
        </Link>
      </section>

      <InstallCard />

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

      {/* Del dispositivo, no de la cuenta: en el móvil del gimnasio interesa que
          suene, en el navegador de casa casi nunca. */}
      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">Avisos del descanso</h2>
        <div className="grid grid-cols-2 gap-2">
          <Chip
            selected={settings.sound}
            onClick={() => updateSettings({ sound: !settings.sound })}
            className="flex items-center justify-center gap-1.5"
          >
            {settings.sound ? (
              <Volume2 className="size-4" aria-hidden />
            ) : (
              <VolumeX className="size-4" aria-hidden />
            )}
            Sonido
          </Chip>
          <Chip
            selected={settings.vibrate}
            onClick={() => updateSettings({ vibrate: !settings.vibrate })}
            className="flex items-center justify-center gap-1.5"
          >
            <Vibrate className="size-4" aria-hidden />
            Vibración
          </Chip>
        </div>
      </section>

      {/* El plan trae un descanso por ejercicio, y no es el mismo para una
          sentadilla pesada que para un curl. Esto lo pisa entero: es para quien
          entrena a reloj, o para el gimnasio lleno donde tres minutos parado no
          se pueden pagar. */}
      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">Descanso entre series</h2>
        <div className="grid grid-cols-2 gap-2">
          <Chip
            selected={settings.restSeconds === null}
            onClick={() => updateSettings({ restSeconds: null })}
          >
            El del plan
          </Chip>
          <Chip
            selected={settings.restSeconds !== null}
            onClick={() => updateSettings({ restSeconds: settings.restSeconds ?? DEFAULT_REST })}
          >
            El mismo siempre
          </Chip>
        </div>

        {settings.restSeconds !== null && (
          <div className="aparece">
            <Stepper
              label="descanso entre series"
              value={settings.restSeconds}
              step={REST_STEP}
              min={REST_MIN}
              max={REST_MAX}
              suffix="seg"
              onChange={(v) => updateSettings({ restSeconds: v })}
            />
            <p className="pt-1 text-xs text-[var(--fg-muted)]">
              {formatDuration(settings.restSeconds)} entre todas las series, en todos los
              ejercicios.
            </p>
          </div>
        )}
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
