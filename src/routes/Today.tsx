import { Link, Navigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, CloudOff, Flame } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import {
  currentWeek,
  getActiveProgram,
  getProgramDays,
  getSessionsForProgram,
  getTranslations,
} from '@/lib/supabase/queries'
import { supabase } from '@/lib/supabase/client'
import { getExercise, muscleEs } from '@/lib/catalog'
import { sessionStreak } from '@/lib/history'
import { dayName, isoDayIndex, todayISO } from '@/lib/utils'
import type { ProgramExercise } from '@/lib/supabase/types'
import { EmptyState, Spinner } from '@/components/ui'
import { buttonClass } from '@/components/ui/Button'
import { Wordmark } from '@/components/Wordmark'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SyncIndicator } from '@/components/SyncIndicator'
import { ExerciseImage } from '@/components/ExerciseImage'
import { InstallBanner } from '@/components/InstallCard'
import { db } from '@/lib/offline'
import { raceWithFallback } from '@/lib/net'

export function Today() {
  const { user } = useAuth()

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['today', user?.id],
    enabled: Boolean(user),
    // Lo que se vio la última vez es infinitamente mejor que una pantalla de
    // error, sobre todo cuando lo único que hace falta es el botón de empezar
    // el entrenamiento, que ya está descargado.
    queryFn: () =>
      raceWithFallback({
        network: loadToday(user!.id),
        fallback: () => loadCachedToday(user!.id),
      }),
  })

  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Sin conexión"
        body="No pudimos cargar tu plan y todavía no hay nada guardado en este dispositivo. Conéctate un momento y vuelve."
      />
    )
  }

  return <TodayView data={data} isFetching={isFetching} />
}

type TodayData = Awaited<ReturnType<typeof loadToday>>

async function loadCachedToday(userId: string): Promise<TodayData | null> {
  const cached = await db.cachedToday.get(userId)
  if (!cached) return null
  return { ...(cached.payload as TodayData), offline: true }
}

async function loadToday(userId: string) {
  const program = await getActiveProgram(userId)
  if (!program) return { program: null, offline: false }

  const days = await getProgramDays(program.id)
  const week = currentWeek(program)
  const todayIndex = isoDayIndex()

  const day = days.find((d) => d.week === week && d.day_index === todayIndex) ?? null
  const sessions = await getSessionsForProgram(
    userId,
    days.map((d) => d.id),
  )

  let exercises: ProgramExercise[] = []
  let translations = {}

  if (day) {
    const { data: rows } = await supabase
      .from('program_exercises')
      .select('*')
      .eq('program_day_id', day.id)
      .order('position')
    exercises = (rows ?? []) as ProgramExercise[]
    translations = await getTranslations(exercises.map((e) => e.exercise_id))
  }

  const upcoming = days
    .filter((d) => d.week === week && d.day_index > todayIndex)
    .sort((a, b) => a.day_index - b.day_index)

  const payload = {
    program,
    week,
    day,
    days,
    exercises,
    translations,
    sessions,
    upcoming,
    offline: false,
  }

  await db.cachedToday.put({ userId, payload, cachedAt: new Date().toISOString() })

  return payload
}

function TodayView({ data, isFetching }: { data: TodayData; isFetching: boolean }) {
  // Sin plan activo, el sitio del usuario es el wizard. Pero solo cuando la
  // respuesta es fresca: redirigir con datos en vuelo manda al cuestionario a
  // quien acaba de crear su plan.
  if (!data.program) {
    if (isFetching) {
      return (
        <div className="grid flex-1 place-items-center">
          <Spinner className="size-8" />
        </div>
      )
    }
    return <Navigate to="/empezar" replace />
  }

  const {
    program,
    week,
    day,
    days = [],
    exercises = [],
    translations = {},
    sessions = [],
    upcoming = [],
  } = data
  const todaySession = day ? sessions.find((s) => s.program_day_id === day.id && s.performed_on === todayISO()) : null
  const isDone = Boolean(todaySession?.completed_at)

  // Dos entrenamientos seguidos todavía no son una racha; a partir de ahí sí, y
  // enseñarla es la forma más barata de que no se rompa.
  const streak = sessionStreak({ days, sessions, week: week!, dayIndex: isoDayIndex() })

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between px-4 pt-4">
        <div className="flex flex-col gap-0.5">
          <Wordmark className="h-6" />
          <p className="eyebrow">
            {program!.name} · Semana {week} de {program!.weeks}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {streak >= 2 && (
            <span
              className="num flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 py-1 text-sm"
              title={`${streak} entrenamientos seguidos sin saltarte ninguno`}
            >
              <Flame className="size-4 text-volt-ink" aria-hidden />
              {streak}
              <span className="sr-only">entrenamientos seguidos</span>
            </span>
          )}
          <SyncIndicator />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
        {data.offline && (
          <p className="flex items-center gap-2 text-sm text-[var(--fg-muted)]">
            <CloudOff className="size-4 shrink-0" aria-hidden />
            Sin conexión. Esto es lo último que descargamos.
          </p>
        )}

        <InstallBanner />

        {!day ? (
          <EmptyState
            title="Hoy toca descansar"
            body="El descanso es parte del plan: es cuando el músculo se construye. Aprovecha para dormir bien."
            action={
              upcoming.length > 0 ? (
                <p className="eyebrow pt-2">
                  Siguiente: {dayName(upcoming[0]!.day_index)} · {upcoming[0]!.title}
                </p>
              ) : undefined
            }
          />
        ) : (
          <>
            <section className="flex flex-col gap-1">
              <p className="eyebrow">{dayName(day.day_index)}</p>
              <h1 className="display text-3xl">{day.title}</h1>
              <p className="text-sm text-[var(--fg-muted)]">
                {day.focus.map(muscleEs).join(' · ')}
                {day.is_deload && ' · Semana de descarga'}
              </p>
            </section>

            <ul className="flex flex-col gap-2">
              {exercises.map((ex) => {
                const catalog = getExercise(ex.exercise_id)
                if (!catalog) return null
                const name =
                  (translations as Record<string, { name: string }>)[ex.exercise_id]?.name ??
                  catalog.name

                return (
                  <li key={ex.id} className="strip flex items-center gap-3 p-2.5">
                    <ExerciseImage images={catalog.images} alt={name} className="size-14" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold leading-tight">{name}</p>
                      <p className="text-xs text-[var(--fg-muted)]">
                        {catalog.primaryMuscles.map(muscleEs).join(' · ')}
                      </p>
                    </div>
                    <span className="num shrink-0 text-base text-[var(--fg-muted)]">
                      {ex.category === 'cardio'
                        ? `${Math.round((ex.target_duration_seconds ?? 0) / 60)} min`
                        : `${ex.target_sets} × ${ex.target_reps ?? ''}`}
                    </span>
                  </li>
                )
              })}
            </ul>

            {isDone ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-volt bg-volt/10 px-4 py-4">
                <CheckCircle2 className="size-5" aria-hidden />
                <span className="font-bold">Hecho. Nos vemos la próxima.</span>
              </div>
            ) : (
              <Link
                to={`/sesion/${day.id}`}
                className={buttonClass({
                  variant: 'volt',
                  size: 'lg',
                  full: true,
                  className: 'sticky bottom-20',
                })}
              >
                {todaySession ? 'Continuar entrenamiento' : 'Empezar entrenamiento'}
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  )
}
