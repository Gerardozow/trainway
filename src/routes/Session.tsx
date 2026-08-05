import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/supabase/useAuth'
import {
  getDayWithExercises,
  getHistoryFor,
  getLatestIntake,
  getProfile,
  getTranslations,
  startSession,
  completeSession,
  swapExercise,
} from '@/lib/supabase/queries'
import { translateExercises } from '@/lib/api'
import { SwapSheet, type SwapScope } from '@/components/SwapSheet'
import type { Exercise } from '@/lib/catalog'
import { db, enqueueSet, localSetsForSession, scheduleFlush, syncNow } from '@/lib/offline'
import { targetFor } from '@/lib/useSessionTargets'
import { CALIBRATION_NOTE } from '@/lib/progression'
import { useWakeLock } from '@/lib/useWakeLock'
import { ExerciseCard } from '@/components/ExerciseCard'
import type { SetValues } from '@/components/SetRow'
import { RestTimer } from '@/components/RestTimer'
import { SyncIndicator } from '@/components/SyncIndicator'
import { Button, Spinner, Textarea } from '@/components/ui'
import { Stepper } from '@/components/ui'

type SetsByExercise = Record<string, SetValues[]>

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
  const [rest, setRest] = useState<{ seconds: number; startedAt: number } | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [swapping, setSwapping] = useState<string | null>(null)
  const [swapBusy, setSwapBusy] = useState(false)
  const [sessionRpe, setSessionRpe] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  useWakeLock(true)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['session', programDayId, user?.id],
    enabled: Boolean(user && programDayId),
    queryFn: async () => {
      const day = await getDayWithExercises(programDayId)
      if (!day) throw new Error('No encontramos ese entrenamiento.')

      const session = await startSession(user!.id, programDayId)
      const exerciseIds = day.exercises.map((e) => e.exercise_id)

      const [history, translations, profile, intake] = await Promise.all([
        getHistoryFor(exerciseIds),
        getTranslations(exerciseIds),
        getProfile(user!.id),
        getLatestIntake(user!.id),
      ])

      // Se guarda el día completo para que el entreno siga funcionando sin señal.
      await db.cachedDays.put({
        programDayId,
        day,
        history,
        cachedAt: new Date().toISOString(),
      })

      return { day, session, history, translations, profile, intake }
    },
  })

  const targets = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(
      data.day.exercises.map((ex) => [
        ex.id,
        targetFor(ex, data.history[ex.exercise_id], data.day.is_deload),
      ]),
    )
  }, [data])

  // Siembra las filas de series con el objetivo y con lo que ya hubiera en local.
  useEffect(() => {
    if (!data) return

    void (async () => {
      const local = await localSetsForSession(data.session.id)

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
      sessionId: data.session.id,
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
      navigator.vibrate?.(30)
      setRest({ seconds: restSeconds, startedAt: Date.now() })
    }
  }

  /** El ejercicio abierto: el primero sin terminar, salvo que se elija otro. */
  const firstIncomplete =
    data?.day.exercises.find((ex) => {
      const rows = sets[ex.id] ?? []
      return rows.length === 0 || rows.some((r) => !r.done)
    })?.id ?? null

  const openId = expandedId ?? firstIncomplete

  /** Series de este ejercicio ya marcadas: cambiarlo hoy falsearía el historial. */
  const hasLoggedSets = (exerciseId: string) => (sets[exerciseId] ?? []).some((r) => r.done)

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
    await completeSession(data.session.id, {
      session_rpe: sessionRpe,
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

        {data.day.exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            translation={data.translations[ex.exercise_id]}
            target={targets[ex.id]!}
            sets={sets[ex.id] ?? []}
            units={data.profile?.units ?? 'metric'}
            expanded={openId === ex.id}
            onToggleExpand={() => setExpandedId(openId === ex.id ? '' : ex.id)}
            onChangeSet={(i, patch) => updateSet(ex.id, i, patch)}
            onToggleDone={(i) => toggleDone(ex.id, i, ex.rest_seconds)}
            onSwap={() => setSwapping(ex.id)}
          />
        ))}

        <section className="strip flex flex-col gap-3 p-4">
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
              onDismiss={() => setRest(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
