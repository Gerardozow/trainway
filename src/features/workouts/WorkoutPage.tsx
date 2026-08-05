import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { formatWeight } from '../../shared/formatWeight'
import {
  addSet,
  finishWorkout,
  getActiveWorkout,
  getSetsFor,
  allSets,
  pendingCount,
  removeSet,
  startWorkout,
} from './workout-local'
import { flushQueue } from './sync-queue'
import { lastPerformance } from './lastPerformance'
import { useOnlineStatus } from './useOnlineStatus'
import { SetLogger } from './SetLogger'
import { SyncBanner } from './SyncBanner'
import { ExercisePicker } from './ExercisePicker'
import { Button, Empty, ErrorText, Eyebrow, ProgressBar, Stat } from '../../shared/ui'
import type { Workout, WorkoutSet } from './workout-types'
import { fetchRoutine } from '../routines/routine-repository'
import { loadExercises } from '../exercises/exercise-cache'
import type { Exercise } from '../exercises/exercise-types'
import type { RoutineExercise } from '../routines/routine-types'

export function WorkoutPage() {
  const { session } = useAuth()
  const online = useOnlineStatus()
  // La pantalla Rutinas navega aquí con la rutina elegida.
  const routineIdFromNav = (useLocation().state as { routineId?: string } | null)
    ?.routineId ?? null

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [ready, setReady] = useState(false)
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [history, setHistory] = useState<WorkoutSet[]>([])
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [pending, setPending] = useState(0)
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [routineItems, setRoutineItems] = useState<RoutineExercise[]>([])
  const [routineName, setRoutineName] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})

  const refreshPending = useCallback(async () => {
    setPending(await pendingCount())
  }, [])

  const refreshSets = useCallback(async (workoutId: string) => {
    setSets(await getSetsFor(workoutId))
    setHistory(await allSets())
  }, [])

  // El catálogo ya está cacheado: sirve para mostrar nombres legibles en vez
  // de identificadores como `3_4_Sit-Up`.
  useEffect(() => {
    let cancelled = false

    loadExercises()
      .then((all) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const entry of all) map[entry.id] = entry.name
        setNames(map)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  // Los ejercicios de la rutina que originó el entreno, para ofrecerlos de
  // acceso rápido en vez de obligar a buscarlos uno por uno.
  useEffect(() => {
    let cancelled = false
    const id = workout?.routineId

    if (!id) {
      setRoutineItems([])
      setRoutineName(null)
      return
    }

    fetchRoutine(id)
      .then((loaded) => {
        if (cancelled || !loaded) return
        setRoutineItems(loaded.exercises)
        setRoutineName(loaded.routine.name)
      })
      // Si la rutina se borró o no hay red, el entreno sigue funcionando como
      // uno libre: se busca el ejercicio a mano.
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [workout?.routineId])

  useEffect(() => {
    let cancelled = false

    getActiveWorkout()
      .then(async (active) => {
        if (cancelled) return
        setWorkout(active)
        if (active) await refreshSets(active.id)
        await refreshPending()
      })
      .catch(() => {
        // IndexedDB puede fallar: modo privado, cuota llena, permisos. Sin este
        // catch la pantalla se quedaría en "Cargando…" para siempre, sin salida.
        if (!cancelled) {
          setLoadError('No se pudo abrir el almacenamiento del dispositivo.')
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [refreshSets, refreshPending])

  // Al recuperar la red se sube lo pendiente. Nunca se bloquea la interfaz
  // esperando: registrar una serie tiene que ser instantáneo siempre.
  useEffect(() => {
    if (!online) return

    void flushQueue()
      .then(refreshPending)
      .catch(() => {})
  }, [online, refreshPending])

  async function onStart() {
    if (!session) return
    const created = await startWorkout(session.user.id, routineIdFromNav)
    setWorkout(created)
    await refreshSets(created.id)
    await refreshPending()
  }

  async function onLog({ weight, reps }: { weight: number; reps: number }) {
    if (!workout || !exercise) return
    await addSet({ workoutId: workout.id, exerciseId: exercise.id, reps, weight })
    await refreshSets(workout.id)
    await refreshPending()
    void flushQueue().then(refreshPending).catch(() => {})
  }

  async function onRemove(setId: string) {
    if (!workout) return
    await removeSet(setId)
    await refreshSets(workout.id)
    await refreshPending()
  }

  async function onFinish() {
    if (!workout) return

    // Terminar cierra la sesión y ya no se pueden añadir series. Se pide
    // confirmación con un segundo toque en el mismo botón en vez de un diálogo
    // del navegador: los diálogos nativos bloquean y en una PWA se ven mal.
    if (!confirmingFinish) {
      setConfirmingFinish(true)
      return
    }

    await finishWorkout(workout.id)
    setWorkout(null)
    setExercise(null)
    setSets([])
    setConfirmingFinish(false)
    await refreshPending()
    void flushQueue().then(refreshPending).catch(() => {})
  }

  // El encabezado se pinta siempre, también mientras carga: que el título de la
  // pantalla aparezca y desaparezca se siente como si la app parpadeara.
  if (!ready || loadError || !workout) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-24">
        <header>
          <Eyebrow tone="cardio">Hoy</Eyebrow>
          <h1 className="mt-1 text-4xl font-extrabold text-content">Entrenar</h1>
        </header>

        {loadError ? (
          <ErrorText>{loadError}</ErrorText>
        ) : !ready ? (
          <p className="py-10 text-center text-content-muted">Cargando…</p>
        ) : (
          <>
            <SyncBanner online={online} pending={pending} />
            <Empty
              title={routineIdFromNav ? 'Tu rutina te espera' : 'Sin entreno en curso'}
              hint={
                routineIdFromNav
                  ? 'Los ejercicios de la rutina aparecerán listos para registrar.'
                  : 'Empieza uno y elige los ejercicios sobre la marcha.'
              }
              action={
                <Button variant="primary" size="lg" onClick={onStart}>
                  {routineIdFromNav ? 'Empezar esta rutina' : 'Empezar entreno'}
                </Button>
              }
            />
          </>
        )}
      </section>
    )
  }

  const totalTarget = routineItems.reduce(
    (sum, item) => sum + (item.targetSets ?? 0),
    0,
  )

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-4 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Eyebrow tone="cardio">En curso</Eyebrow>
          <h1 className="mt-1 text-4xl font-extrabold text-content">
            {routineName ?? 'Entreno libre'}
          </h1>
        </div>
      </header>

      <SyncBanner online={online} pending={pending} />

      <div className="flex gap-3">
        <Stat value={sets.length} label="Series hoy" />
        <Stat
          value={new Set(sets.map((set) => set.exerciseId)).size}
          label="Ejercicios"
        />
        <Stat
          value={formatWeight(
            sets.reduce((sum, set) => sum + set.weight * set.reps, 0),
          ).replace(' kg', '')}
          label="Volumen kg"
        />
      </div>

      {totalTarget > 0 && (
        <div>
          <ProgressBar value={sets.length} max={totalTarget} />
          <p className="mt-2 text-sm text-content-muted">
            <b className="text-content">{sets.length}</b> de {totalTarget} series
            de la rutina
          </p>
        </div>
      )}

      {exercise ? (
        <>
          <SetLogger
            exerciseName={exercise.name}
            lastSets={lastPerformance(history, exercise.id, workout.id)}
            target={
              routineItems
                .filter((item) => item.exerciseId === exercise.id)
                .map((item) => ({ sets: item.targetSets, reps: item.targetReps }))[0] ??
              null
            }
            onLog={onLog}
          />
          <Button onClick={() => setExercise(null)}>Cambiar de ejercicio</Button>
        </>
      ) : (
        <>
          {routineItems.length > 0 && (
            <div className="flex flex-col gap-2">
              <Eyebrow tone="strength">Tu rutina</Eyebrow>
              <ul className="flex flex-col gap-2">
                {routineItems.map((item) => {
                  const done = sets.filter(
                    (entry) => entry.exerciseId === item.exerciseId,
                  ).length
                  const target = item.targetSets ?? 0
                  const complete = target > 0 && done >= target

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setExercise({
                            id: item.exerciseId,
                            name: names[item.exerciseId] ?? item.exerciseId,
                            category: null,
                            equipment: null,
                            force: null,
                            level: null,
                            mechanic: null,
                            primaryMuscles: [],
                            secondaryMuscles: [],
                            instructions: [],
                            imagePaths: [],
                          })
                        }
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-surface-raised p-3.5 text-left transition-colors ${
                          complete ? 'border-ok' : 'border-border hover:border-strength'
                        }`}
                      >
                        <span className="min-w-0 truncate font-medium text-content">
                          {names[item.exerciseId] ?? item.exerciseId}
                        </span>
                        <span
                          className={`shrink-0 text-sm tabular-nums ${
                            complete ? 'text-ok' : 'text-content-muted'
                          }`}
                        >
                          {target > 0
                            ? `${done}/${target}${complete ? ' ✓' : ''}`
                            : done > 0
                              ? `${done} series`
                              : `${item.targetReps ?? '?'} reps`}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <ExercisePicker onPick={setExercise} />
        </>
      )}

      {sets.length > 0 && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Series de hoy</Eyebrow>
          <ul className="flex flex-col gap-1.5">
            {sets.map((set) => (
              <li
                key={set.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised px-3.5 py-2.5"
              >
                <span className="min-w-0 truncate text-sm text-content">
                  <b className="tabular-nums">
                    {formatWeight(set.weight)} × {set.reps}
                  </b>
                  <span className="text-content-muted">
                    {' '}
                    · {names[set.exerciseId] ?? set.exerciseId}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(set.id)}
                  aria-label={`Borrar serie de ${formatWeight(set.weight)} por ${set.reps}`}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs uppercase tracking-wider text-content-muted transition-colors hover:text-danger"
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        variant={confirmingFinish ? 'danger' : 'secondary'}
        onClick={onFinish}
        className="mt-2"
      >
        {confirmingFinish ? '¿Seguro? Toca otra vez' : 'Terminar entreno'}
      </Button>
    </section>
  )
}
