import { useEffect, useMemo, useState } from 'react'
import { loadExercises } from './exercise-cache'
import { searchExercises } from './searchExercises'
import { ExerciseCard, isCardio } from './ExerciseCard'
import { Empty, ErrorText, Field, SectionHead } from '../../shared/ui'
import type { Exercise } from './exercise-types'

export function ExercisesPage() {
  const [all, setAll] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)

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

  // Solo los músculos que de verdad aparecen: una lista fija tendría opciones
  // que no devuelven nada.
  const muscles = useMemo(() => {
    if (!all) return []
    const found = new Set<string>()
    for (const exercise of all) {
      for (const name of exercise.primaryMuscles) found.add(name)
    }
    return [...found].sort()
  }, [all])

  const visible = useMemo(
    () => (all ? searchExercises(all, query, muscle) : []),
    [all, query, muscle],
  )

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 pb-24">
      <SectionHead
        title="Ejercicios"
        subtitle="Cada uno con la foto del inicio y del final del movimiento, para que sepas exactamente qué hacer al llegar."
      />

      {error ? (
        <ErrorText>{error}</ErrorText>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Field
                id="exercise-search"
                label="Buscar"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="sentadilla, press…"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:w-52">
              <label
                htmlFor="exercise-muscle"
                className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-content-muted"
              >
                Músculo
              </label>
              <select
                id="exercise-muscle"
                value={muscle ?? ''}
                onChange={(event) => setMuscle(event.target.value || null)}
                className="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-content focus:border-content-muted focus:outline-none"
              >
                <option value="">Todos</option>
                {muscles.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-content-muted">
            <span className="inline-flex items-center gap-2">
              <i className="h-3 w-3 rounded-sm bg-strength" /> Fuerza
            </span>
            <span className="inline-flex items-center gap-2">
              <i className="h-3 w-3 rounded-sm bg-cardio" /> Cardio y movilidad
            </span>
            {all && (
              <span className="ml-auto">
                {visible.length} de {all.length}
              </span>
            )}
          </div>

          {all === null ? (
            <p className="py-10 text-center text-content-muted">Cargando…</p>
          ) : visible.length === 0 ? (
            <Empty
              title="Ningún ejercicio coincide"
              hint="Prueba con menos letras, o quita el filtro de músculo."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {visible.slice(0, 60).map((exercise) => (
                <ExerciseCard key={exercise.id} exercise={exercise} />
              ))}
            </div>
          )}

          {all && visible.length > 60 && (
            <p className="text-center text-sm text-content-muted">
              Se muestran 60 de {visible.length}. Escribe para acotar.
            </p>
          )}
        </>
      )}
    </section>
  )
}

export { isCardio }
