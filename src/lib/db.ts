import Dexie, { type EntityTable } from 'dexie'
import type { Exercise } from '../features/exercises/exercise-types'

/**
 * Base local del navegador. El catálogo de ejercicios se guarda entero porque
 * es estático, cabe (~873 filas de texto) y así buscar funciona sin señal —
 * que es la situación normal en un gimnasio.
 *
 * `meta` guarda pares clave/valor sueltos, como cuándo se cacheó el catálogo.
 */
const db = new Dexie('trainway') as Dexie & {
  exercises: EntityTable<Exercise, 'id'>
  meta: EntityTable<{ key: string; value: string }, 'key'>
}

db.version(1).stores({
  exercises: 'id, name',
  meta: 'key',
})

export { db }
