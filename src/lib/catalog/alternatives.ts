import type { Exercise } from './types'

/**
 * Alternativas para un ejercicio: otra forma de trabajar lo mismo cuando la
 * máquina está ocupada o el gimnasio no la tiene.
 *
 * Esto NO pasa por la IA. El catálogo ya sabe qué músculo trabaja cada
 * ejercicio, así que la respuesta es instantánea y funciona sin señal — que es
 * justo la situación: estás de pie delante de una máquina ocupada.
 */
export type AlternativeCriteria = {
  /** El que se quiere sustituir. */
  current: Exercise
  /** Equipamiento del gimnasio. Vacío = sin restricción. */
  equipment: string[]
  /** Ejercicios que ya están en la sesión de hoy: no tiene sentido repetir. */
  excludeIds?: string[]
  limit?: number
}

const ALWAYS_AVAILABLE = 'body only'

/**
 * Ordena por parecido al original. El criterio, de más a menos importante:
 *
 *  1. Mismo músculo primario — es lo único que no se negocia.
 *  2. Misma mecánica (compuesto o aislamiento): sustituir una sentadilla por
 *     una extensión de cuádriceps trabaja el músculo pero no el patrón.
 *  3. Mismo tipo de fuerza (empuje, tirón, isométrico).
 *  4. Equipamiento distinto al original — si buscas alternativa suele ser
 *     porque ese aparato no está disponible.
 */
function similarity(candidate: Exercise, current: Exercise): number {
  let score = 0

  const primarios = new Set(current.primaryMuscles)
  const coincidencias = candidate.primaryMuscles.filter((m) => primarios.has(m)).length
  score -= coincidencias * 100

  if (candidate.mechanic === current.mechanic) score -= 30
  if (candidate.force === current.force) score -= 15
  if (candidate.level === current.level) score -= 5
  if (candidate.equipment !== current.equipment) score -= 10

  return score
}

export function findAlternatives(
  criteria: AlternativeCriteria,
  catalog: Exercise[],
): Exercise[] {
  const { current, equipment, excludeIds = [], limit = 12 } = criteria

  const excluidos = new Set([current.id, ...excludeIds])
  const primarios = new Set(current.primaryMuscles)
  const disponible = new Set([...equipment, ALWAYS_AVAILABLE])

  const candidatos = catalog.filter((e) => {
    if (excluidos.has(e.id)) return false
    if (e.category === 'stretching') return false

    // Solo cardio sustituye a cardio, y al revés.
    if ((e.category === 'cardio') !== (current.category === 'cardio')) return false

    // Sin equipamiento declarado no se filtra: mejor ofrecer de más que nada.
    if (equipment.length > 0 && !disponible.has(e.equipment ?? 'other')) return false

    // El músculo primario es la condición: una alternativa que no lo trabaja
    // no es una alternativa.
    return e.primaryMuscles.some((m) => primarios.has(m))
  })

  candidatos.sort((a, b) => {
    const diff = similarity(a, current) - similarity(b, current)
    return diff !== 0 ? diff : a.id.localeCompare(b.id)
  })

  return candidatos.slice(0, limit)
}
