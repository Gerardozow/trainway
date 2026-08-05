import raw from '../../../data/exercises.json'
import { filterCandidates as filterWith } from './filter'
import type { Criteria, Exercise } from './types'

export * from './types'
export { GYM_CARDIO_IDS } from './filter'
export * from './labels.es'

/** El catálogo completo, empaquetado en el bundle para que funcione offline. */
export const ALL_EXERCISES = raw as Exercise[]

const BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id)
}

export function exerciseExists(id: string): boolean {
  return BY_ID.has(id)
}

const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises'

/**
 * jsDelivr y no raw.githubusercontent: es un CDN de verdad, con cabeceras de
 * caché correctas y sin límite de tasa.
 */
export function imageUrl(path: string): string {
  return `${CDN}/${path}`
}

export function filterCandidates(criteria: Criteria): Exercise[] {
  return filterWith(criteria, ALL_EXERCISES)
}
