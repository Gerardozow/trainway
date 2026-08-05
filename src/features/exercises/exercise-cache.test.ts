import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Exercise } from './exercise-types'

const fetchAllExercises = vi.fn()

vi.mock('./exercise-repository', () => ({
  fetchAllExercises: () => fetchAllExercises(),
}))

const { db } = await import('../../lib/db')
const { loadExercises, CACHED_AT_KEY, MAX_AGE_MS } = await import('./exercise-cache')

function make(id: string, name: string): Exercise {
  return {
    id,
    name,
    category: null,
    equipment: null,
    force: null,
    level: null,
    mechanic: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    imagePaths: [],
  }
}

const FRESH = [make('1', 'Sentadilla'), make('2', 'Press')]

describe('exercise-cache', () => {
  beforeEach(async () => {
    await db.exercises.clear()
    await db.meta.clear()
    fetchAllExercises.mockReset().mockResolvedValue(FRESH)
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('va al servidor cuando la cache está vacía', async () => {
    const result = await loadExercises()

    expect(fetchAllExercises).toHaveBeenCalledOnce()
    expect(result).toHaveLength(2)
  })

  it('guarda en local lo que trajo del servidor', async () => {
    await loadExercises()
    expect(await db.exercises.count()).toBe(2)
  })

  it('anota cuándo se cacheó', async () => {
    await loadExercises()
    const stamp = await db.meta.get(CACHED_AT_KEY)
    expect(Number(stamp?.value)).toBeGreaterThan(0)
  })

  it('no vuelve al servidor si la cache está fresca', async () => {
    await loadExercises()
    fetchAllExercises.mockClear()

    const result = await loadExercises()

    expect(fetchAllExercises).not.toHaveBeenCalled()
    expect(result).toHaveLength(2)
  })

  it('devuelve la copia local aunque el servidor esté caído', async () => {
    await loadExercises()
    fetchAllExercises.mockRejectedValue(new Error('sin red'))

    const result = await loadExercises()

    expect(result).toHaveLength(2)
  })

  it('propaga el error si no hay copia local y el servidor falla', async () => {
    fetchAllExercises.mockRejectedValue(new Error('sin red'))
    await expect(loadExercises()).rejects.toThrow('sin red')
  })

  it('refresca en segundo plano cuando la cache está vieja', async () => {
    await loadExercises()
    await db.meta.put({
      key: CACHED_AT_KEY,
      value: String(Date.now() - MAX_AGE_MS - 1),
    })
    fetchAllExercises.mockClear().mockResolvedValue([make('3', 'Peso muerto')])

    // Devuelve lo viejo de inmediato: la pantalla pinta sin esperar.
    const result = await loadExercises()
    expect(result.map((e) => e.id).sort()).toEqual(['1', '2'])

    // Y el refresco sí ocurre, sin bloquear.
    await vi.waitFor(() => expect(fetchAllExercises).toHaveBeenCalledOnce())
    await vi.waitFor(async () => {
      expect((await db.exercises.toArray()).map((e) => e.id)).toEqual(['3'])
    })
  })

  it('no rompe si el refresco en segundo plano falla', async () => {
    await loadExercises()
    await db.meta.put({
      key: CACHED_AT_KEY,
      value: String(Date.now() - MAX_AGE_MS - 1),
    })
    fetchAllExercises.mockClear().mockRejectedValue(new Error('sin red'))

    const result = await loadExercises()

    expect(result).toHaveLength(2)
    await vi.waitFor(() => expect(fetchAllExercises).toHaveBeenCalled())
    // La copia local sigue intacta pese al fallo.
    expect(await db.exercises.count()).toBe(2)
  })

  it('trata una marca de tiempo ausente como cache vieja', async () => {
    await loadExercises()
    await db.meta.clear()
    fetchAllExercises.mockClear().mockResolvedValue(FRESH)

    await loadExercises()

    await vi.waitFor(() => expect(fetchAllExercises).toHaveBeenCalledOnce())
  })

  it('trata una marca de tiempo corrupta como cache vieja', async () => {
    await loadExercises()
    await db.meta.put({ key: CACHED_AT_KEY, value: 'no-es-un-numero' })
    fetchAllExercises.mockClear().mockResolvedValue(FRESH)

    await loadExercises()

    await vi.waitFor(() => expect(fetchAllExercises).toHaveBeenCalledOnce())
  })

  it('reemplaza el catálogo entero al refrescar, sin dejar huérfanos', async () => {
    await loadExercises()
    await db.meta.clear()
    fetchAllExercises.mockClear().mockResolvedValue([make('9', 'Nuevo')])

    // Devuelve lo viejo; el reemplazo ocurre en segundo plano.
    await loadExercises()

    await vi.waitFor(async () => {
      expect((await db.exercises.toArray()).map((e) => e.id)).toEqual(['9'])
    })
    expect(await db.exercises.count()).toBe(1)
  })
})
