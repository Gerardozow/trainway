import { useState } from 'react'
import { ExercisePicker } from '../workouts/ExercisePicker'
import { moveExercise } from './routine-order'
import type { Routine, RoutineExercise } from './routine-types'
import type { Exercise } from '../exercises/exercise-types'

const NUMBER_FIELD =
  'w-20 rounded-md border border-border bg-surface px-2 py-1 text-content'

export function RoutineEditor({
  routine,
  exercises,
  exerciseNames,
  saving,
  error,
  onSave,
  onBack,
}: {
  routine: Routine
  exercises: RoutineExercise[]
  /** Nombre legible por id; el catálogo ya está cacheado en el cliente. */
  exerciseNames: Record<string, string>
  saving: boolean
  /** Un fallo al guardar tiene que verse aquí: la lista no está en pantalla. */
  error: string | null
  onSave: (exercises: RoutineExercise[]) => Promise<void>
  onBack: () => void
}) {
  const [items, setItems] = useState<RoutineExercise[]>(exercises)
  const [adding, setAdding] = useState(false)
  const [names, setNames] = useState<Record<string, string>>(exerciseNames)

  function onPick(exercise: Exercise) {
    setNames((previous) => ({ ...previous, [exercise.id]: exercise.name }))
    setItems((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        routineId: routine.id,
        exerciseId: exercise.id,
        position: previous.length,
        targetSets: null,
        targetReps: null,
        targetWeight: null,
        notes: null,
      },
    ])
    setAdding(false)
  }

  function onMove(from: number, to: number) {
    setItems((previous) => moveExercise(previous, from, to))
  }

  function onRemove(id: string) {
    setItems((previous) =>
      previous
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, position: index })),
    )
  }

  function onTarget(id: string, field: 'targetSets' | 'targetReps', raw: string) {
    const value = raw.trim() === '' ? null : Number(raw)
    setItems((previous) =>
      previous.map((item) =>
        item.id === id
          ? { ...item, [field]: value !== null && Number.isFinite(value) ? value : null }
          : item,
      ),
    )
  }

  if (adding) {
    return (
      <section className="flex flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold text-content">Añadir ejercicio</h1>
        <ExercisePicker onPick={onPick} />
        <button
          type="button"
          onClick={() => setAdding(false)}
          className="rounded-lg border border-border px-4 py-3 font-medium text-content"
        >
          Cancelar
        </button>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-content">{routine.name}</h1>

      {items.length === 0 ? (
        <p className="py-6 text-center text-content-muted">
          Esta rutina todavía no tiene ejercicios.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-content">
                  {names[item.exerciseId] ?? item.exerciseId}
                </span>

                <div className="flex shrink-0 gap-1">
                  {/* Botones de subir y bajar en vez de arrastrar: en móvil el
                      arrastre es frágil y difícil de probar. */}
                  <button
                    type="button"
                    onClick={() => onMove(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Subir ${names[item.exerciseId] ?? item.exerciseId}`}
                    className="rounded-md border border-border px-2 py-1 text-content disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(index, index + 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Bajar ${names[item.exerciseId] ?? item.exerciseId}`}
                    className="rounded-md border border-border px-2 py-1 text-content disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Quitar ${names[item.exerciseId] ?? item.exerciseId}`}
                    className="rounded-md border border-border px-2 py-1 text-sm text-content-muted"
                  >
                    Quitar
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-content-muted">
                <label className="flex items-center gap-2">
                  Series
                  <input
                    inputMode="numeric"
                    value={item.targetSets ?? ''}
                    onChange={(event) =>
                      onTarget(item.id, 'targetSets', event.target.value)
                    }
                    aria-label={`Series objetivo de ${names[item.exerciseId] ?? item.exerciseId}`}
                    className={NUMBER_FIELD}
                  />
                </label>

                <label className="flex items-center gap-2">
                  Reps
                  <input
                    inputMode="numeric"
                    value={item.targetReps ?? ''}
                    onChange={(event) =>
                      onTarget(item.id, 'targetReps', event.target.value)
                    }
                    aria-label={`Repeticiones objetivo de ${names[item.exerciseId] ?? item.exerciseId}`}
                    className={NUMBER_FIELD}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="rounded-lg border border-border px-4 py-3 font-medium text-content"
      >
        Añadir ejercicio
      </button>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => onSave(items)}
        disabled={saving}
        className="rounded-lg bg-brand px-4 py-3 font-medium text-brand-content disabled:opacity-60"
      >
        {saving ? 'Guardando…' : 'Guardar rutina'}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border border-border px-4 py-3 font-medium text-content"
      >
        Volver
      </button>
    </section>
  )
}
