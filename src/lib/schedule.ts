import type { ProgramDay } from '@/lib/supabase/types'

/**
 * El lunes de la semana de esa fecha, a medianoche local.
 *
 * Las semanas del bloque van de lunes a domingo porque los días del plan son
 * días de la semana: contar siete días desde un miércoles hacía que "semana 1"
 * fuera de miércoles a martes y nada cuadraba con los días marcados.
 */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offset = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - offset)
  return d
}

export type DayMove = { from: number; to: number }

/**
 * Cómo pasar de unos días a otros sin pisar ninguno por el camino.
 *
 * Cada movimiento es un UPDATE sobre todas las semanas del bloque, y la tabla
 * no deja dos entrenamientos en el mismo día de la misma semana. Así que se
 * mueve primero lo que va a un día libre, y un ciclo (lunes↔miércoles) se
 * rompe pasando por un día que nadie usa. Con menos de siete días siempre hay
 * uno; con siete no hay nada que mover.
 *
 * Se empareja por orden: el primer entrenamiento de la semana va al primer día
 * elegido, el segundo al segundo, y así se conserva el reparto del plan.
 */
export function planMoves(from: number[], to: number[]): DayMove[] {
  const a = [...from].sort((x, y) => x - y)
  const b = [...to].sort((x, y) => x - y)
  let pending = a.map((f, i) => ({ from: f, to: b[i]! })).filter((m) => m.from !== m.to)

  const occupied = new Set(a)
  const moves: DayMove[] = []

  while (pending.length > 0) {
    const ready = pending.find((m) => !occupied.has(m.to))

    if (ready) {
      moves.push({ ...ready })
      occupied.delete(ready.from)
      occupied.add(ready.to)
      pending = pending.filter((m) => m !== ready)
      continue
    }

    // Ciclo: todos los destinos están ocupados por días que también se mueven.
    const free = [1, 2, 3, 4, 5, 6, 7].find((d) => !occupied.has(d))
    if (free === undefined) break
    const stuck = pending[0]!
    moves.push({ from: stuck.from, to: free })
    occupied.delete(stuck.from)
    occupied.add(free)
    stuck.from = free
  }

  return moves
}

/**
 * El entrenamiento que se ofrece cuando hoy no toca ninguno: el primero de la
 * semana que falta por hacer, pasado o futuro. El orden importa más que la
 * fecha — el plan reparte los grupos musculares pensando en esa secuencia.
 */
export function pendingDay(
  days: ProgramDay[],
  completed: Set<string>,
  week: number,
  todayIndex: number,
): ProgramDay | null {
  return (
    days
      .filter((d) => d.week === week && d.day_index !== todayIndex && !completed.has(d.id))
      .sort((x, y) => x.day_index - y.day_index)[0] ?? null
  )
}
