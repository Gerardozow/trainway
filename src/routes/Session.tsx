import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CloudOff } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import {
  getDayWithExercises,
  getHistoryFor,
  getLatestIntake,
  getProfile,
  getTranslations,
  swapExercise,
} from '@/lib/supabase/queries'
import { translateExercises } from '@/lib/api'
import { SwapSheet, type SwapScope } from '@/components/SwapSheet'
import type { Exercise } from '@/lib/catalog'
import type {
  DayWithExercises,
  ExerciseTranslation,
  Intake,
  Profile,
  SetLog,
} from '@/lib/supabase/types'
import {
  completeSessionLocal,
  db,
  enqueueSet,
  localSetsForSession,
  resolveSession,
  scheduleFlush,
  syncNow,
} from '@/lib/offline'
import { targetFor } from '@/lib/useSessionTargets'
import { CALIBRATION_NOTE } from '@/lib/progression'
import { previousSession } from '@/lib/history'
import { raceWithFallback } from '@/lib/net'
import { loadRest, saveRest, type RestState } from '@/lib/rest'
import { loadSettings } from '@/lib/settings'
import { useWakeLock } from '@/lib/useWakeLock'
import { ExerciseCard } from '@/components/ExerciseCard'
import type { SetValues } from '@/components/SetRow'
import { RestTimer } from '@/components/RestTimer'
import { SyncIndicator } from '@/components/SyncIndicator'
import { Button, Spinner, Textarea } from '@/components/ui'
import { Stepper } from '@/components/ui'

type SetsByExercise = Record<string, SetValues[]>

/**
 * "Ese día no existe" no es lo mismo que "no hay red".
 *
 * Sin distinguirlo, un id inventado en la barra de direcciones acabaría
 * buscando en la caché local y enseñando el entrenamiento de otro día.
 */
class NotFound extends Error {}

type SessionData = {
  day: DayWithExercises
  sessionId: string
  history: Record<string, SetLog[]>
  translations: Record<string, ExerciseTranslation>
  profile: Profile | null
  intake: Intake | null
  offline: boolean
}

async function loadDayFromNetwork(programDayId: string, userId: string): Promise<SessionData> {
  const day = await getDayWithExercises(programDayId)
  if (!day) throw new NotFound('No encontramos ese entrenamiento.')

  const exerciseIds = day.exercises.map((e) => e.exercise_id)

  const [session, history, translations, profile, intake] = await Promise.all([
    resolveSession(userId, programDayId),
    getHistoryFor(exerciseIds),
    getTranslations(exerciseIds),
    getProfile(userId),
    getLatestIntake(userId),
  ])

  // Se guarda el día completo para que el entreno siga funcionando sin señal.
  await db.cachedDays.put({
    programDayId,
    day,
    history,
    translations,
    profile,
    intake,
    cachedAt: new Date().toISOString(),
  })

  return { day, sessionId: session.id, history, translations, profile, intake, offline: false }
}

/**
 * El entrenamiento tal y como se descargó la última vez.
 *
 * La sesión se resuelve sin tocar la red —ya se sabe que no contesta— y, si no
 * había ninguna empezada, se crea con un id generado aquí que se sube después.
 */
async function loadCachedDay(programDayId: string, userId: string): Promise<SessionData | null> {
  const cached = await db.cachedDays.get(programDayId)
  if (!cached) return null

  const session = await resolveSession(userId, programDayId, { allowNetwork: false })

  return {
    day: cached.day,
    sessionId: session.id,
    history: cached.history,
    translations: cached.translations ?? {},
    profile: cached.profile ?? null,
    intake: cached.intake ?? null,
    offline: true,
  }
}

/** La cabecera es fija: sin el margen, el título del ejercicio queda debajo. */
const SCROLL_OFFSET = 72

function scrollToCard(domId: string) {
  const el = document.getElementById(domId)
  if (!el) return

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
  window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' })
}

const emptySet = (): SetValues => ({
  weight: null,
  reps: null,
  durationSeconds: null,
  intensity: null,
  done: false,
})

export function Session() {
  const { programDayId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [sets, setSets] = useState<SetsByExercise>({})
  const [rest, setRestState] = useState<RestState | null>(() => loadRest())
  const [finishing, setFinishing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [postponed, setPostponed] = useState<string[]>([])
  const [swapping, setSwapping] = useState<string | null>(null)
  const [swapBusy, setSwapBusy] = useState(false)
  const [sessionRpe, setSessionRpe] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  useWakeLock(true)

  /** El descanso vive también en localStorage: recargar no puede tirarlo. */
  const setRest = useCallback((next: RestState | null) => {
    setRestState(next)
    saveRest(next)
  }, [])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['session', programDayId, user?.id],
    enabled: Boolean(user && programDayId),
    queryFn: () =>
      raceWithFallback({
        network: loadDayFromNetwork(programDayId, user!.id),
        fallback: () => loadCachedDay(programDayId, user!.id),
        // Un id que no existe tiene que fallar de verdad, no caer en la caché.
        rethrow: (err) => err instanceof NotFound,
      }),
  })

  /**
   * El orden de hoy.
   *
   * Posponer no toca la base de datos: es "esta máquina está ocupada, ya
   * volveré", no un cambio de plan. Al recargar vuelve el orden del programa.
   */
  const exercises = useMemo(() => {
    if (!data) return []
    if (postponed.length === 0) return data.day.exercises

    const enSitio = data.day.exercises.filter((ex) => !postponed.includes(ex.id))
    const alFinal = postponed
      .map((id) => data.day.exercises.find((ex) => ex.id === id))
      .filter((ex) => ex !== undefined)

    return [...enSitio, ...alFinal]
  }, [data, postponed])

  const targets = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(
      data.day.exercises.map((ex) => [
        ex.id,
        targetFor(ex, data.history[ex.exercise_id], data.day.is_deload),
      ]),
    )
  }, [data])

  /** Lo que se hizo la última vez en cada ejercicio. Hoy no cuenta. */
  const previous = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(
      data.day.exercises.map((ex) => [ex.id, previousSession(data.history[ex.exercise_id])]),
    )
  }, [data])

  // Siembra las filas de series con el objetivo y con lo que ya hubiera en local.
  useEffect(() => {
    if (!data) return

    void (async () => {
      const local = await localSetsForSession(data.sessionId)

      setSets(
        Object.fromEntries(
          data.day.exercises.map((ex) => {
            const target = targets[ex.id]
            const rows = Array.from({ length: target?.sets ?? ex.target_sets }, (_, i) => {
              const saved = local.find((l) => l.programExerciseId === ex.id && l.setIndex === i)
              if (saved) {
                return {
                  weight: saved.weight,
                  reps: saved.reps,
                  durationSeconds: saved.durationSeconds,
                  intensity: saved.intensity,
                  done: saved.done,
                }
              }
              return {
                ...emptySet(),
                weight: target?.weight ?? null,
                reps: target?.repRange?.[0] ?? null,
                durationSeconds: target?.durationSeconds ?? null,
              }
            })
            return [ex.id, rows]
          }),
        ),
      )
    })()
  }, [data, targets])

  async function persist(exerciseId: string, index: number, values: SetValues) {
    if (!data) return
    await enqueueSet({
      sessionId: data.sessionId,
      programExerciseId: exerciseId,
      setIndex: index,
      done: values.done,
      weight: values.weight,
      reps: values.reps,
      durationSeconds: values.durationSeconds,
      distanceM: null,
      intensity: values.intensity,
      rpe: null,
      note: null,
      loggedAt: new Date().toISOString(),
    })

    // No esperar al sondeo de 30 s: en el gimnasio se marca una serie y se
    // bloquea el teléfono.
    scheduleFlush()
  }

  function updateSet(exerciseId: string, index: number, patch: Partial<SetValues>) {
    setSets((prev) => {
      const rows = [...(prev[exerciseId] ?? [])]
      const next = { ...rows[index]!, ...patch }
      rows[index] = next
      void persist(exerciseId, index, next)
      return { ...prev, [exerciseId]: rows }
    })
  }

  function toggleDone(exerciseId: string, index: number, restSeconds: number) {
    const current = sets[exerciseId]?.[index]
    if (!current) return

    const done = !current.done
    updateSet(exerciseId, index, { done })

    // El descanso arranca solo al completar, no al desmarcar.
    if (done) {
      if (loadSettings().vibrate) navigator.vibrate?.(30)
      setRest({ seconds: restSeconds, startedAt: Date.now() })
    }
  }

  /** El ejercicio abierto: el primero sin terminar, salvo que se elija otro. */
  const firstIncomplete =
    exercises.find((ex) => {
      const rows = sets[ex.id] ?? []
      return rows.length === 0 || rows.some((r) => !r.done)
    })?.id ?? null

  const openId = expandedId ?? firstIncomplete

  /** Series de este ejercicio ya marcadas: cambiarlo hoy falsearía el historial. */
  const hasLoggedSets = (exerciseId: string) => (sets[exerciseId] ?? []).some((r) => r.done)

  /** Al final de la cola y a por el siguiente. La máquina ocupada no para la sesión. */
  function postpone(exerciseId: string) {
    setPostponed((prev) => [...prev.filter((id) => id !== exerciseId), exerciseId])

    const next = exercises.find((ex) => {
      if (ex.id === exerciseId) return false
      const rows = sets[ex.id] ?? []
      return rows.length === 0 || rows.some((r) => !r.done)
    })
    setExpandedId(next?.id ?? '')
    if (next) setTimeout(() => scrollToCard(`ejercicio-${next.id}`), 50)
  }

  // --- Avance automático ----------------------------------------------------
  //
  // Al terminar un ejercicio, el siguiente se abre y la pantalla se mueve hasta
  // él. Sin esto hay que buscarlo y tocarlo con las manos ocupadas: el acordeón
  // ahorra scroll pero deja el trabajo de navegar al usuario.

  const completedIds = useMemo(() => {
    const done = new Set<string>()
    for (const [id, rows] of Object.entries(sets)) {
      if (rows.length > 0 && rows.every((r) => r.done)) done.add(id)
    }
    return done
  }, [sets])

  const knownComplete = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!data || Object.keys(sets).length === 0) return

    // El primer paso solo hace la foto: al retomar una sesión a medias, lo que
    // ya estaba terminado no es una novedad a la que saltar.
    if (knownComplete.current === null) {
      knownComplete.current = completedIds
      return
    }

    const justFinished = [...completedIds].find((id) => !knownComplete.current!.has(id))
    knownComplete.current = completedIds
    if (!justFinished) return

    // El siguiente es el que viene DESPUÉS del que se acaba de terminar. Solo
    // si ya no queda nada por delante se vuelve a lo que se saltó antes:
    // mandar la pantalla hacia atrás a mitad de sesión desorienta.
    const from = exercises.findIndex((ex) => ex.id === justFinished) + 1
    const pending = (ex: (typeof exercises)[number]) => !completedIds.has(ex.id)
    const next = exercises.slice(from).find(pending) ?? exercises.find(pending)
    setExpandedId(next?.id ?? '')

    // Un respiro antes de moverse: da tiempo a ver la fila llenarse de amarillo.
    const timer = setTimeout(
      () => scrollToCard(next ? `ejercicio-${next.id}` : 'cerrar-sesion'),
      350,
    )
    return () => clearTimeout(timer)
  }, [completedIds, data, sets])

  async function applySwap(programExerciseId: string, chosen: Exercise, scope: SwapScope) {
    if (!data) return
    setSwapBusy(true)
    try {
      await swapExercise({
        programExerciseId,
        programDayId,
        newExerciseId: chosen.id,
        newCategory: chosen.category,
        scope,
      })

      // El ejercicio nuevo puede no estar traducido todavía. Falla en silencio:
      // sin traducción se ve el nombre en inglés, que es mejor que un error.
      void translateExercises([chosen.id])

      setSwapping(null)
      await refetch()
    } finally {
      setSwapBusy(false)
    }
  }

  async function finish() {
    if (!data) return
    setFinishing(true)
    setRest(null)
    // Se cierra en local y se sube con el resto de la cola: terminar el
    // entrenamiento no puede depender de tener señal.
    await completeSessionLocal(data.sessionId, {
      sessionRpe: sessionRpe,
      notes: notes.trim() || null,
    })
    await syncNow()
    navigate('/', { replace: true })
  }

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[var(--fg-muted)]">
          {error instanceof Error ? error.message : 'No pudimos abrir el entrenamiento.'}
        </p>
        <Button onClick={() => navigate('/')}>Volver a Hoy</Button>
      </main>
    )
  }

  const totalSets = Object.values(sets).reduce((n, rows) => n + rows.length, 0)
  const doneSets = Object.values(sets).reduce((n, rows) => n + rows.filter((r) => r.done).length, 0)
  const allDone = totalSets > 0 && doneSets === totalSets

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-1 px-2 py-1">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Volver a Hoy"
            className="grid size-12 place-items-center rounded-xl active:bg-[var(--surface-2)]"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <p className="eyebrow">
              Semana {data.day.week}
              {data.day.is_deload && ' · Descarga'}
            </p>
            <h1 className="display truncate text-lg">{data.day.title}</h1>
          </div>

          <SyncIndicator />
          <span className="num px-2 text-sm text-[var(--fg-muted)]">
            {doneSets}/{totalSets}
          </span>
        </div>

        <div className="h-0.5 w-full bg-[var(--surface-2)]">
          <div
            className="h-full bg-volt transition-[width] duration-300"
            style={{ width: totalSets ? `${(doneSets / totalSets) * 100}%` : '0%' }}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-3 py-3">
        {data.offline && (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm leading-snug">
            <CloudOff className="mt-0.5 size-4 shrink-0 text-[var(--fg-muted)]" aria-hidden />
            <span>
              <strong>Sin conexión.</strong> Este entrenamiento estaba guardado en el móvil. Entrena
              normal: todo lo que marques se sube solo en cuanto haya señal.
            </span>
          </p>
        )}

        {Object.values(targets).some((t) => t?.note === CALIBRATION_NOTE) && (
          <p className="rounded-xl border-l-2 border-volt bg-[var(--surface)] px-4 py-3 text-sm leading-snug">
            <strong>Semana de calibración.</strong> Usa un peso donde las últimas 2 repeticiones
            cuesten y anótalo. A partir de aquí Trainway ajusta la carga solo.
          </p>
        )}

        {data.day.is_deload && (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm leading-snug">
            <strong>Semana de descarga.</strong> Menos series y menos peso a propósito. Es lo que
            deja que el cuerpo asimile las tres semanas anteriores.
          </p>
        )}

        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            translation={data.translations[ex.exercise_id]}
            target={targets[ex.id]!}
            sets={sets[ex.id] ?? []}
            units={data.profile?.units ?? 'metric'}
            previous={previous[ex.id] ?? null}
            expanded={openId === ex.id}
            onToggleExpand={() => setExpandedId(openId === ex.id ? '' : ex.id)}
            onChangeSet={(i, patch) => updateSet(ex.id, i, patch)}
            onToggleDone={(i) => toggleDone(ex.id, i, ex.rest_seconds)}
            onSwap={() => setSwapping(ex.id)}
            onPostpone={exercises.length > 1 ? () => postpone(ex.id) : undefined}
          />
        ))}

        <section id="cerrar-sesion" className="strip flex flex-col gap-3 scroll-mt-20 p-4">
          <h2 className="display text-lg">Cerrar la sesión</h2>

          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">¿Qué tan dura estuvo? (1 a 10)</span>
            <Stepper
              label="esfuerzo de la sesión"
              value={sessionRpe}
              min={1}
              max={10}
              step={1}
              onChange={setSessionRpe}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Notas</span>
            <Textarea
              rows={2}
              value={notes}
              maxLength={500}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="El hombro molestó en la última serie"
            />
          </label>

          <Button variant="volt" size="lg" full disabled={finishing} onClick={() => void finish()}>
            {finishing ? <Spinner /> : allDone ? 'Terminar entrenamiento' : 'Terminar de todos modos'}
          </Button>
        </section>
      </main>

      {swapping && (
        <SwapSheet
          currentId={data.day.exercises.find((e) => e.id === swapping)!.exercise_id}
          equipment={data.intake?.equipment ?? []}
          excludeIds={data.day.exercises.map((e) => e.exercise_id)}
          translations={data.translations}
          canSwapToday={!hasLoggedSets(swapping)}
          busy={swapBusy}
          onSwap={(chosen, scope) => void applySwap(swapping, chosen, scope)}
          onClose={() => setSwapping(null)}
        />
      )}

      {rest && (
        <div className="sticky bottom-0 z-10 bg-[var(--bg)]/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto max-w-lg">
            <RestTimer
              seconds={rest.seconds}
              startedAt={rest.startedAt}
              onAdjust={(delta) =>
                setRest({ ...rest, seconds: Math.max(15, rest.seconds + delta) })
              }
              onDismiss={() => setRest(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
