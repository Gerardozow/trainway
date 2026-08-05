import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { loadExercises } from '../exercises/exercise-cache'
import {
  createRoutine,
  deleteRoutine,
  fetchRoutine,
  fetchRoutines,
  saveExercises,
} from './routine-repository'
import { RoutineEditor } from './RoutineEditor'
import type { Routine, RoutineExercise } from './routine-types'

type Editing = {
  routine: Routine
  exercises: RoutineExercise[]
}

export function RoutinesPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [routines, setRoutines] = useState<Routine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    setRoutines(await fetchRoutines())
  }, [])

  useEffect(() => {
    let cancelled = false

    fetchRoutines()
      .then((list) => {
        if (!cancelled) setRoutines(list)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar tus rutinas.')
      })

    // El catálogo ya está cacheado: sirve para mostrar nombres legibles en vez
    // de identificadores como `3_4_Sit-Up`.
    loadExercises()
      .then((all) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        for (const exercise of all) map[exercise.id] = exercise.name
        setNames(map)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    if (!session) return

    setCreating(true)
    setError(null)
    const result = await createRoutine(session.user.id, name)
    setCreating(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setName('')
    await refresh()
  }

  async function onEdit(routine: Routine) {
    setError(null)
    try {
      const loaded = await fetchRoutine(routine.id)
      if (!loaded) {
        setError('Esa rutina ya no existe.')
        return
      }
      setEditing({ routine: loaded.routine, exercises: loaded.exercises })
    } catch {
      setError('No se pudo cargar la rutina.')
    }
  }

  async function onSaveExercises(exercises: RoutineExercise[]) {
    if (!editing) return

    setSaving(true)
    const result = await saveExercises(editing.routine.id, exercises)
    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setEditing(null)
    await refresh()
  }

  async function onDelete(routineId: string) {
    // Borrar una rutina no se puede deshacer: se pide confirmación con un
    // segundo toque en el mismo botón, como Terminar entreno.
    if (confirmingDelete !== routineId) {
      setConfirmingDelete(routineId)
      return
    }

    setConfirmingDelete(null)
    const result = await deleteRoutine(routineId)
    if (result.error) {
      setError(result.error)
      return
    }
    await refresh()
  }

  if (editing) {
    return (
      <RoutineEditor
        routine={editing.routine}
        exercises={editing.exercises}
        exerciseNames={names}
        saving={saving}
        error={error}
        onSave={onSaveExercises}
        onBack={() => setEditing(null)}
      />
    )
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-content">Rutinas</h1>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={onCreate} className="flex flex-col gap-2">
        <label htmlFor="routine-name" className="text-sm text-content-muted">
          Nueva rutina
        </label>
        <div className="flex gap-2">
          <input
            id="routine-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Pierna, Empuje…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={creating}
            className="shrink-0 rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>

      {routines === null ? (
        <p className="py-6 text-center text-content-muted">Cargando…</p>
      ) : routines.length === 0 ? (
        <p className="py-6 text-center text-content-muted">
          Todavía no tienes rutinas. Crea la primera arriba.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((routine) => (
            <li
              key={routine.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-raised p-3"
            >
              <span className="min-w-0 truncate font-medium text-content">
                {routine.name}
              </span>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/', { state: { routineId: routine.id } })}
                  className="rounded-md bg-brand px-3 py-1 text-sm font-medium text-brand-content"
                >
                  Entrenar
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(routine)}
                  className="rounded-md border border-border px-3 py-1 text-sm text-content"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(routine.id)}
                  className="rounded-md border border-border px-3 py-1 text-sm text-content-muted"
                >
                  {confirmingDelete === routine.id ? '¿Seguro?' : 'Borrar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/ejercicios"
        className="mt-2 text-center text-sm text-content-muted underline"
      >
        Ver el catálogo de ejercicios
      </Link>
    </section>
  )
}
