import { useEffect, useMemo, useState } from 'react'
import { loadExercises } from './exercise-cache'
import { searchExercises } from './searchExercises'
import { ExerciseList } from './ExerciseList'
import { ExerciseSearch } from './ExerciseSearch'
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

  // Solo los músculos que de verdad aparecen: ofrecer una lista fija tendría
  // opciones que no devuelven nada.
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
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-content">Ejercicios</h1>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <>
          <ExerciseSearch
            query={query}
            onQueryChange={setQuery}
            muscle={muscle}
            onMuscleChange={setMuscle}
            muscles={muscles}
          />

          {all === null ? (
            <p className="px-4 py-8 text-center text-content-muted">Cargando…</p>
          ) : (
            <ExerciseList exercises={visible} />
          )}
        </>
      )}
    </section>
  )
}
