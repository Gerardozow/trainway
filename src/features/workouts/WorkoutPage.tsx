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
      <section className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold text-content">Entrenar</h1>

        {loadError ? (
          <p role="alert" className="text-sm text-danger">
            {loadError}
          </p>
        ) : !ready ? (
          <p className="text-center text-content-muted">Cargando…</p>
        ) : (
          <>
            <SyncBanner online={online} pending={pending} />
            <button
              type="button"
              onClick={onStart}
              className="rounded-lg bg-brand px-4 py-4 text-lg font-medium text-brand-content"
            >
              {routineIdFromNav ? 'Empezar esta rutina' : 'Empezar entreno'}
            </button>
          </>
        )}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-content">Entrenar</h1>

      <SyncBanner online={online} pending={pending} />

      {exercise ? (
        <>
          <SetLogger
            exerciseName={exercise.name}
            lastSets={lastPerformance(history, exercise.id, workout.id)}
            onLog={onLog}
          />
          <button
            type="button"
            onClick={() => setExercise(null)}
            className="rounded-lg border border-border px-4 py-3 font-medium text-content"
          >
            Cambiar de ejercicio
          </button>
        </>
      ) : (
        <>
          {routineItems.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-content">
                {routineName ?? 'Tu rutina'}
              </h2>
              <ul className="flex flex-col gap-2">
                {routineItems.map((item) => {
                  const done = sets.filter(
                    (entry) => entry.exerciseId === item.exerciseId,
                  ).length

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
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface-raised p-3 text-left"
                      >
                        <span className="min-w-0 truncate text-content">
                          {names[item.exerciseId] ?? item.exerciseId}
                        </span>
                        <span className="shrink-0 text-sm text-content-muted">
                          {done > 0
                            ? `${done}/${item.targetSets ?? '?'} series`
                            : item.targetSets
                              ? `${item.targetSets} × ${item.targetReps ?? '?'}`
                              : 'sin objetivo'}
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
          <h2 className="text-lg font-semibold text-content">Series de hoy</h2>
          <ul className="flex flex-col gap-2">
            {sets.map((set) => (
              <li
                key={set.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2"
              >
                <span className="min-w-0 truncate text-content">
                  {names[set.exerciseId] ?? set.exerciseId} ·{' '}
                  {formatWeight(set.weight)} × {set.reps}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(set.id)}
                  aria-label={`Borrar serie de ${formatWeight(set.weight)} por ${set.reps}`}
                  className="shrink-0 rounded-md border border-border px-3 py-1 text-sm text-content-muted"
                >
                  Borrar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onFinish}
        className="rounded-lg border border-border px-4 py-3 font-medium text-content"
      >
        {confirmingFinish ? '¿Seguro? Toca otra vez' : 'Terminar entreno'}
      </button>
    </section>
  )
}
