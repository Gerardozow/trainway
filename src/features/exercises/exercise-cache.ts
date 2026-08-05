import { db } from '../../lib/db'
import { fetchAllExercises } from './exercise-repository'
import type { Exercise } from './exercise-types'

export const CACHED_AT_KEY = 'exercises:cachedAt'

/** Una semana. El catálogo es estático; refrescar más seguido no aporta nada. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

async function refresh(): Promise<Exercise[]> {
  const fresh = await fetchAllExercises()

  // Se reemplaza entero en una sola transacción: un catálogo a medias entre el
  // borrado y la escritura sería peor que uno viejo.
  await db.transaction('rw', db.exercises, db.meta, async () => {
    await db.exercises.clear()
    await db.exercises.bulkAdd(fresh)
    await db.meta.put({ key: CACHED_AT_KEY, value: String(Date.now()) })
  })

  return fresh
}

/**
 * Devuelve el catálogo, prefiriendo la copia local.
 *
 * Si la copia está vieja se refresca en segundo plano: la pantalla pinta de
 * inmediato con lo que hay y se actualiza sola cuando llegan los datos nuevos.
 * Si el refresco falla —lo normal en un gimnasio sin señal— la copia local
 * sigue sirviendo y nadie se entera.
 */
export async function loadExercises(): Promise<Exercise[]> {
  const cached = await db.exercises.toArray()

  if (cached.length === 0) return refresh()

  const stamp = await db.meta.get(CACHED_AT_KEY)
  const cachedAt = stamp ? Number(stamp.value) : Number.NaN
  const isStale = !Number.isFinite(cachedAt) || Date.now() - cachedAt > MAX_AGE_MS

  if (isStale) {
    // Sin await a propósito: no bloquea el primer pintado.
    void refresh().catch(() => {})
  }

  return cached
}
