import type { ProgramExercise } from '@/lib/supabase/types'

/**
 * El descanso, como se dice en el gimnasio: "90 s" o "2 min", no "1:30".
 * Un cero es cardio o un circuito, y ahí no hay descanso que anunciar.
 */
export function formatRest(seconds: number): string | null {
  if (seconds <= 0) return null
  if (seconds < 120) return `${seconds} s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`
}

type DoseFields = Pick<
  ProgramExercise,
  'category' | 'target_sets' | 'target_reps' | 'target_duration_seconds' | 'rest_seconds'
>

/** "3 × 10-12 · 90 s", o "15 min" en cardio. */
export function formatDose(ex: DoseFields): string {
  if (ex.category === 'cardio') {
    return `${Math.round((ex.target_duration_seconds ?? 0) / 60)} min`
  }

  const volume = ex.target_reps ? `${ex.target_sets} × ${ex.target_reps}` : `${ex.target_sets} series`
  const rest = formatRest(ex.rest_seconds)
  return rest ? `${volume} · ${rest}` : volume
}

export type PlanSummary = {
  days: number
  /** Las series que más se repiten. Null si la semana es solo cardio. */
  sets: number | null
  /** "6-12": del número más bajo al más alto que aparece en las reps. */
  reps: string | null
  cardioMinutes: number
}

/**
 * Los cuatro números de la cabecera del plan, sacados del plan real.
 *
 * La moda y no la media: "3 series" es lo que la persona va a hacer casi
 * siempre; "3.4 series" no es algo que se pueda hacer.
 */
export function planSummary(exercises: ProgramExercise[], trainingDays: number): PlanSummary {
  const strength = exercises.filter((e) => e.category !== 'cardio')

  const counts = new Map<number, number>()
  for (const e of strength) counts.set(e.target_sets, (counts.get(e.target_sets) ?? 0) + 1)
  let sets: number | null = null
  for (const [value, n] of counts) {
    if (sets === null || n > counts.get(sets)! || (n === counts.get(sets) && value < sets)) sets = value
  }

  const numbers = strength.flatMap((e) => (e.target_reps?.match(/\d+/g) ?? []).map(Number))
  const reps = numbers.length
    ? Math.min(...numbers) === Math.max(...numbers)
      ? String(numbers[0])
      : `${Math.min(...numbers)}-${Math.max(...numbers)}`
    : null

  const cardioSeconds = exercises
    .filter((e) => e.category === 'cardio')
    .reduce((total, e) => total + (e.target_duration_seconds ?? 0), 0)

  return { days: trainingDays, sets, reps, cardioMinutes: Math.round(cardioSeconds / 60) }
}
