import { FOCUS_GROUPS } from '@/lib/catalog'
import type { Experience, Goal } from '@/lib/supabase/types'

/**
 * Las opciones del cuestionario, en un solo sitio.
 *
 * Las usa el wizard de alta y la pantalla de preferencias. Duplicadas, una
 * lista se queda atrás y el usuario acaba viendo dos catálogos distintos de lo
 * mismo.
 */

export const GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: 'hipertrofia', label: 'Ganar músculo', hint: 'Volumen moderado, rangos de 6 a 12' },
  { value: 'fuerza', label: 'Ganar fuerza', hint: 'Cargas altas, rangos de 3 a 6' },
  { value: 'perdida_grasa', label: 'Perder grasa', hint: 'Mantener músculo, más densidad' },
  { value: 'resistencia', label: 'Aguantar más', hint: 'Series largas, descansos cortos' },
  { value: 'general', label: 'Estar en forma', hint: 'Equilibrado, sin especializar' },
]

export const EXPERIENCES: { value: Experience; label: string; hint: string }[] = [
  { value: 'principiante', label: 'Principiante', hint: 'Menos de 6 meses entrenando' },
  { value: 'intermedio', label: 'Intermedio', hint: 'Entre 6 meses y 2 años' },
  { value: 'avanzado', label: 'Avanzado', hint: 'Más de 2 años, técnica sólida' },
]

export const EQUIPMENT_OPTIONS = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebells',
  'bands',
  'body only',
]

export const DAYS_OPTIONS = [2, 3, 4, 5, 6, 7]
export const MINUTES_OPTIONS = [30, 45, 60, 75, 90, 120]
export const MAX_NOTES = 2000

/** Grupos del wizard -> músculos del catálogo, que es como se guardan. */
export function musclesFromGroups(keys: string[]): string[] {
  return keys.flatMap((k) => FOCUS_GROUPS.find((g) => g.key === k)?.muscles ?? [])
}

/** El camino de vuelta, para volver a marcar las fichas al editar. */
export function groupsFromMuscles(muscles: string[]): string[] {
  return FOCUS_GROUPS.filter((g) => g.muscles.some((m) => muscles.includes(m))).map((g) => g.key)
}
