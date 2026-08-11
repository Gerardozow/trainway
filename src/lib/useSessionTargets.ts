import { nextTarget, parseRepRange, type LastPerformance, type Target } from '@/lib/progression'
import { localDay } from '@/lib/history'
import { roundToHalf } from '@/lib/utils'
import type { ProgramExercise, SetLog } from '@/lib/supabase/types'

/**
 * Convierte la prescripción guardada más el historial real en el objetivo de
 * hoy. Esto es lo que hace que la app "vaya mejorando" sin llamar a la IA.
 */
export function targetFor(
  exercise: ProgramExercise,
  history: SetLog[] | undefined,
  isDeload: boolean,
): Target {
  const repRange = exercise.target_reps ? parseRepRange(exercise.target_reps) : null

  const base: Target = {
    sets: exercise.target_sets,
    repRange,
    weight: exercise.target_weight,
    durationSeconds: exercise.target_duration_seconds,
    note: null,
  }

  const target = nextTarget(base, exercise.progression_scheme, lastPerformance(history, repRange))

  // El recorte de volumen de la descarga ya viene en `target_sets` desde
  // expandBlock; aquí solo se baja la carga.
  return isDeload && target.weight !== null
    ? { ...target, weight: roundToHalf(target.weight * 0.9) }
    : target
}

/** Agrupa el historial por día del usuario, del más reciente al más antiguo. */
function groupByDay(history: SetLog[]): SetLog[][] {
  const byDay = new Map<string, SetLog[]>()

  for (const log of history) {
    const day = localDay(log.logged_at)
    const bucket = byDay.get(day)
    if (bucket) bucket.push(log)
    else byDay.set(day, [log])
  }

  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, logs]) => logs)
}

/**
 * Reconstruye la última sesión de este ejercicio y cuántas veces seguidas se
 * falló el piso del rango de repeticiones. Dos fallos seguidos disparan el
 * deload en `nextTarget`.
 */
export function lastPerformance(
  history: SetLog[] | undefined,
  repRange: [number, number] | null,
): LastPerformance | null {
  if (!history || history.length === 0) return null

  const days = groupByDay(history)
  const latest = days[0] ?? []

  return {
    sets: latest.map((l) => ({
      reps: l.reps,
      weight: l.weight,
      durationSeconds: l.duration_seconds,
      done: l.done,
    })),
    failedFloorStreak: repRange ? countFailedFloor(days, repRange[0]) : 0,
  }
}

/** Sesiones consecutivas, desde la más reciente, donde alguna serie no llegó al piso. */
function countFailedFloor(days: SetLog[][], floor: number): number {
  let streak = 0

  for (const logs of days) {
    const reps = logs.filter((l) => l.done).map((l) => l.reps)
    if (reps.length === 0) break

    const failed = reps.some((r) => r !== null && r < floor)
    if (!failed) break
    streak++
  }

  return streak
}
