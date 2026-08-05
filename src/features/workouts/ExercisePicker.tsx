import { useEffect, useMemo, useState } from 'react'
import { loadExercises } from '../exercises/exercise-cache'
import { searchExercises } from '../exercises/searchExercises'
import { exerciseImageUrl } from '../exercises/exercise-repository'
import type { Exercise } from '../exercises/exercise-types'

/**
 * Elegir un ejercicio del catálogo. Cada elemento es un botón y no un elemento
 * de lista pasivo, para que se pueda llegar con el teclado y anunciarse como
 * accionable.
 */
export function ExercisePicker({ onPick }: { onPick: (exercise: Exercise) => void }) {
  const [all, setAll] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false

    loadExercises()
      .then((exercises) => {
        if (!cancelled) setAll(exercises)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el catálogo de ejercicios.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(
    // Se recorta la lista: 873 botones de golpe no ayudan a nadie, y en cuanto
    // escribes dos letras el filtro hace el trabajo.
    () => (all ? searchExercises(all, query, null).slice(0, 30) : []),
    [all, query],
  )

  if (error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="picker-search" className="text-sm text-content-muted">
        Buscar ejercicio
      </label>
      <input
        id="picker-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-content"
        placeholder="sentadilla, press…"
        autoComplete="off"
      />

      {all === null ? (
        <p className="py-6 text-center text-content-muted">Cargando…</p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-content-muted">
          Ningún ejercicio coincide con tu búsqueda.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => onPick(exercise)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 text-left"
              >
                {exercise.imagePaths[0] ? (
                  <img
                    src={exerciseImageUrl(exercise.imagePaths[0])}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 shrink-0 rounded-md bg-surface" />
                )}

                <span className="min-w-0">
                  <span className="block truncate font-medium text-content">
                    {exercise.name}
                  </span>
                  <span className="block truncate text-sm text-content-muted">
                    {exercise.primaryMuscles.join(', ') || 'Sin músculo registrado'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
