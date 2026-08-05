import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PendingKind } from './workout-types'

const pushWorkout = vi.fn()
const pushSet = vi.fn()
const pushFinish = vi.fn()
const pushDeleteSet = vi.fn()

vi.mock('./workout-repository', () => ({
  pushWorkout: (...args: unknown[]) => pushWorkout(...args),
  pushSet: (...args: unknown[]) => pushSet(...args),
  pushFinish: (...args: unknown[]) => pushFinish(...args),
  pushDeleteSet: (...args: unknown[]) => pushDeleteSet(...args),
}))

const { db } = await import('../../lib/db')
const { flushQueue } = await import('./sync-queue')

let clock = 0

async function enqueue(kind: PendingKind, payload: unknown) {
  clock += 1
  await db.syncQueue.add({
    id: crypto.randomUUID(),
    kind,
    payload,
    // Instantes crecientes y distintos: el orden de la cola es lo que se prueba.
    createdAt: new Date(clock * 1000).toISOString(),
    attempts: 0,
    lastError: null,
  })
}

describe('sync-queue', () => {
  beforeEach(async () => {
    clock = 0
    await db.syncQueue.clear()
    pushWorkout.mockReset().mockResolvedValue(undefined)
    pushSet.mockReset().mockResolvedValue(undefined)
    pushFinish.mockReset().mockResolvedValue(undefined)
    pushDeleteSet.mockReset().mockResolvedValue(undefined)
  })

  it('no hace nada con la cola vacía', async () => {
    expect(await flushQueue()).toEqual({ sent: 0, failed: 0 })
    expect(pushWorkout).not.toHaveBeenCalled()
  })

  it('sube una operación y la saca de la cola', async () => {
    await enqueue('workout', { id: 'w1' })

    const result = await flushQueue()

    expect(pushWorkout).toHaveBeenCalledOnce()
    expect(result.sent).toBe(1)
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('manda cada tipo a su función', async () => {
    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })
    await enqueue('deleteSet', { id: 's1' })
    await enqueue('finish', { id: 'w1', endedAt: 'x' })

    await flushQueue()

    expect(pushWorkout).toHaveBeenCalledOnce()
    expect(pushSet).toHaveBeenCalledOnce()
    expect(pushDeleteSet).toHaveBeenCalledOnce()
    expect(pushFinish).toHaveBeenCalledOnce()
  })

  it('respeta el orden de encolado', async () => {
    const order: string[] = []
    pushWorkout.mockImplementation(async () => void order.push('workout'))
    pushSet.mockImplementation(async () => void order.push('set'))

    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })

    await flushQueue()

    expect(order).toEqual(['workout', 'set'])
  })

  it('conserva en la cola lo que falló', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })

    expect(await flushQueue()).toEqual({ sent: 0, failed: 1 })
    expect(await db.syncQueue.count()).toBe(1)
  })

  it('cuenta el intento fallido y guarda el motivo', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })

    await flushQueue()

    const [pending] = await db.syncQueue.toArray()
    expect(pending.attempts).toBe(1)
    expect(pending.lastError).toContain('sin red')
  })

  it('acumula los intentos entre vaciados', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })

    await flushQueue()
    await flushQueue()

    expect((await db.syncQueue.toArray())[0].attempts).toBe(2)
  })

  it('se detiene en el primer fallo para no romper el orden', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })

    await flushQueue()

    // La serie depende de que su entreno exista en el servidor: subirla
    // primero fallaría por la llave foránea.
    expect(pushSet).not.toHaveBeenCalled()
    expect(await db.syncQueue.count()).toBe(2)
  })

  it('reporta como pendiente todo lo que quedó tras el fallo', async () => {
    pushWorkout.mockRejectedValue(new Error('sin red'))
    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })
    await enqueue('set', { id: 's2' })

    expect(await flushQueue()).toEqual({ sent: 0, failed: 3 })
  })

  it('trata el conflicto de clave duplicada como éxito', async () => {
    pushSet.mockRejectedValue(new Error('23505 duplicate key value'))
    await enqueue('set', { id: 's1' })

    const result = await flushQueue()

    // Significa que un intento anterior sí llegó y se perdió la respuesta.
    // Tratarlo como error dejaría la cola atorada para siempre.
    expect(result.sent).toBe(1)
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('sigue con lo que resta tras un duplicado', async () => {
    pushSet.mockRejectedValue(new Error('23505 duplicate key value'))
    await enqueue('set', { id: 's1' })
    await enqueue('finish', { id: 'w1', endedAt: 'x' })

    expect(await flushQueue()).toEqual({ sent: 2, failed: 0 })
    expect(pushFinish).toHaveBeenCalledOnce()
  })

  it('vacía la cola completa cuando todo sale bien', async () => {
    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })
    await enqueue('finish', { id: 'w1', endedAt: 'x' })

    expect(await flushQueue()).toEqual({ sent: 3, failed: 0 })
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('no pierde nada cuando falla a medio camino', async () => {
    await enqueue('workout', { id: 'w1' })
    await enqueue('set', { id: 's1' })
    await enqueue('set', { id: 's2' })

    pushSet
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('sin red'))

    const result = await flushQueue()

    expect(result).toEqual({ sent: 2, failed: 1 })
    // Lo subido se fue; lo que falló sigue guardado para el próximo intento.
    expect(await db.syncQueue.count()).toBe(1)
  })
})
