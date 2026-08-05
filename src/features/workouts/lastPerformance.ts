import type { WorkoutSet } from './workout-types'

/**
 * Las series del último entreno en que se hizo este ejercicio.
 *
 * Ver en gris lo que levantaste la última vez es la diferencia entre una
 * libreta y una herramienta: es la razón por la que alguien abre la app un
 * martes cualquiera.
 *
 * Se excluyen los calentamientos, que no son referencia de nada, y se puede
 * excluir el entreno en curso: comparar contra lo que acabas de levantar hace
 * un minuto no dice nada.
 */
export function lastPerformance(
  sets: WorkoutSet[],
  exerciseId: string,
  excludeWorkoutId?: string,
): WorkoutSet[] | null {
  const candidates = sets.filter(
    (set) =>
      set.exerciseId === exerciseId &&
      !set.isWarmup &&
      set.workoutId !== excludeWorkoutId,
  )

  if (candidates.length === 0) return null

  // El entreno más reciente es el que contiene la serie más reciente. Se busca
  // así y no por fecha de entreno porque aquí solo hay series.
  const latest = candidates.reduce((best, current) =>
    current.completedAt > best.completedAt ? current : best,
  )

  return candidates
    .filter((set) => set.workoutId === latest.workoutId)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
}
