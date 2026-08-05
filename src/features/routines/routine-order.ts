import type { RoutineExercise } from './routine-types'

/**
 * Mueve un ejercicio de una posición a otra y renumera la lista entera.
 *
 * Renumerar todo es O(n) sobre una lista de diez elementos; llevar posiciones
 * fraccionarias o una lista enlazada para evitarlo costaría más de lo que
 * ahorra, y dejaría números que no se pueden leer de un vistazo.
 *
 * Devuelve una lista nueva: mutar la que recibe rompería la comparación de
 * React y la lista no se repintaría.
 */
export function moveExercise(
  items: RoutineExercise[],
  from: number,
  to: number,
): RoutineExercise[] {
  const inRange = (index: number) => index >= 0 && index < items.length

  if (!inRange(from) || !inRange(to)) {
    return items.map((entry, index) => ({ ...entry, position: index }))
  }

  const reordered = [...items]
  const [moved] = reordered.splice(from, 1)
  reordered.splice(to, 0, moved)

  return reordered.map((entry, index) => ({ ...entry, position: index }))
}
