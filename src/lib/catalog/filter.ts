import type { Criteria, Exercise, Experience, Level } from './types'

/**
 * Cardio que existe dentro de un gimnasio. Se excluyen a propósito Bicycling,
 * Skating y Trail_Running_Walking: son de exterior y el alcance del proyecto es
 * solo gimnasio, sin GPS.
 */
export const GYM_CARDIO_IDS: readonly string[] = [
  'Bicycling_Stationary',
  'Elliptical_Trainer',
  'Jogging_Treadmill',
  'Prowler_Sprint',
  'Recumbent_Bike',
  'Rope_Jumping',
  'Rowing_Stationary',
  'Running_Treadmill',
  'Stairmaster',
  'Step_Mill',
  'Walking_Treadmill',
]

/** Un principiante no debe recibir un arranque de potencia como tercer ejercicio. */
const LEVELS_FOR: Record<Experience, Level[]> = {
  principiante: ['beginner'],
  intermedio: ['beginner', 'intermediate'],
  avanzado: ['beginner', 'intermediate', 'expert'],
}

/** Categorías que nunca se prescriben como ejercicio de un plan. */
const EXCLUDED_CATEGORIES = new Set(['stretching'])

const ALWAYS_AVAILABLE = 'body only'

function scoreOf(e: Exercise, focus: Set<string>): number {
  let score = 0
  if (e.primaryMuscles.some((m) => focus.has(m))) score -= 100
  else if (e.secondaryMuscles.some((m) => focus.has(m))) score -= 50
  if (e.mechanic === 'compound') score -= 10
  return score
}

/**
 * Reduce el catálogo a los candidatos que la IA puede elegir.
 *
 * Este filtro es la barrera que impide que el modelo invente ejercicios: solo
 * recibe estos ids, y `validatePlan` rechaza cualquier otro. Sin esto, el plan
 * acaba con ejercicios plausibles que no tienen imagen.
 */
export function filterCandidates(criteria: Criteria, catalog: Exercise[]): Exercise[] {
  const { equipment, level, focusMuscles, includeCardio, limit } = criteria
  const allowedLevels = new Set(LEVELS_FOR[level])
  const focus = new Set(focusMuscles)

  const pick = (allowedEquipment: Set<string>) =>
    catalog.filter((e) => {
      if (EXCLUDED_CATEGORIES.has(e.category)) return false
      if (!allowedLevels.has(e.level)) return false

      if (e.category === 'cardio') {
        return includeCardio && GYM_CARDIO_IDS.includes(e.id)
      }

      return allowedEquipment.has(e.equipment ?? 'other')
    })

  let result = pick(new Set([...equipment, ALWAYS_AVAILABLE]))

  // Sin equipamiento declarado la lista se queda muy corta; caer a peso corporal
  // es mejor que devolver vacío y romper la generación del plan.
  if (result.length === 0) result = pick(new Set([ALWAYS_AVAILABLE]))

  // Orden estable: relevancia, luego alfabético. El desempate por nombre es lo
  // que hace la función determinista entre llamadas.
  result.sort((a, b) => {
    const diff = scoreOf(a, focus) - scoreOf(b, focus)
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  })

  return limit ? result.slice(0, limit) : result
}
