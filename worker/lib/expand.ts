import { getExercise } from '@/lib/catalog'
import type { ProgressionScheme } from '@/lib/progression'
import type { AiExercise, AiPlan } from './schemas'

/**
 * Expande la semana que generó la IA a un mesociclo de 4 semanas.
 *
 * La IA solo entrega la plantilla; el arco del bloque se construye aquí, con
 * reglas, porque un modelo pidiendo 96 entradas de JSON se contradice a sí
 * mismo y cuesta cuatro veces más.
 *
 * El arco:
 *   semanas 1-2  plantilla tal cual
 *   semana 3     +1 serie en los compuestos (acumulación de volumen)
 *   semana 4     descarga: volumen al 60%
 *
 * El PESO no se guarda: se calcula al abrir la sesión con `nextTarget` leyendo
 * el último registro real. Por eso saltarse un día no rompe nada.
 */

export const BLOCK_WEEKS = 4
const MAX_SETS = 6

export type ExpandedExercise = {
  exercise_id: string
  category: string
  position: number
  target_sets: number
  target_reps: string | null
  target_duration_seconds: number | null
  target_rpe: number | null
  rest_seconds: number
  progression_scheme: ProgressionScheme
  coach_note: string | null
}

export type ExpandedDay = {
  week: number
  day_index: number
  title: string
  focus: string[]
  is_deload: boolean
  exercises: ExpandedExercise[]
}

function toScheme(p: AiExercise['progression']): ProgressionScheme {
  switch (p.type) {
    case 'linear':
      return { type: 'linear', incrementKg: p.increment_kg || 2.5 }
    case 'time':
      return {
        type: 'time',
        incrementSeconds: p.increment_seconds || 60,
        maxSeconds: p.max_seconds || 2400,
      }
    case 'intensity':
      return { type: 'intensity' }
    default:
      return { type: 'double', incrementKg: p.increment_kg || 2.5 }
  }
}

function setsForWeek(base: number, week: number, isCompound: boolean): number {
  if (week === BLOCK_WEEKS) return Math.max(1, Math.round(base * 0.6))
  if (week === 3 && isCompound) return Math.min(MAX_SETS, base + 1)
  return base
}

export function expandBlock(plan: AiPlan, weeks = BLOCK_WEEKS): ExpandedDay[] {
  const days: ExpandedDay[] = []

  for (let week = 1; week <= weeks; week++) {
    const isDeload = week === weeks

    for (const day of plan.days) {
      const exercises = day.exercises.map((ex, position): ExpandedExercise => {
        const catalog = getExercise(ex.exercise_id)
        const isCompound = catalog?.mechanic === 'compound'
        const duration = ex.duration_seconds ?? null

        return {
          exercise_id: ex.exercise_id,
          category: catalog?.category ?? 'strength',
          position,
          target_sets: setsForWeek(ex.sets, week, isCompound),
          target_reps: ex.reps ?? null,
          target_duration_seconds:
            duration !== null && isDeload ? Math.round(duration * 0.6) : duration,
          target_rpe: ex.target_rpe ?? null,
          rest_seconds: ex.rest_seconds,
          progression_scheme: toScheme(ex.progression),
          coach_note: ex.coach_note ?? null,
        }
      })

      days.push({
        week,
        day_index: day.day_index,
        title: day.title,
        focus: day.focus,
        is_deload: isDeload,
        exercises,
      })
    }
  }

  return days
}
