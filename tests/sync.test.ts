import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { db, enqueueSet, flushQueue, pendingCount, clearLocal } from '@/lib/offline'
import type { PendingSet } from '@/lib/offline'

const entry = (over: Partial<PendingSet> = {}): Omit<PendingSet, 'clientId' | 'synced'> => ({
  sessionId: 's1',
  programExerciseId: 'pe1',
  setIndex: 0,
  done: true,
  weight: 60,
  reps: 10,
  durationSeconds: null,
  distanceM: null,
  intensity: null,
  rpe: 8,
  note: null,
  loggedAt: '2026-08-05T10:00:00.000Z',
  ...over,
})

const okClient = () => ({
  upsertSetLogs: vi.fn().mockResolvedValue({ error: null }),
  upsertSessions: vi.fn().mockResolvedValue({ error: null }),
  findSessionId: vi.fn().mockResolvedValue(null),
})

const failClient = () => ({
  upsertSetLogs: vi.fn().mockResolvedValue({ error: new Error('sin red') }),
  upsertSessions: vi.fn().mockResolvedValue({ error: null }),
  findSessionId: vi.fn().mockResolvedValue(null),
})

describe('cola de sincronización', () => {
  beforeEach(async () => {
    await clearLocal()
  })

  it('encolar escribe en local y cuenta como pendiente', async () => {
    await enqueueSet(entry())
    expect(await pendingCount()).toBe(1)
  })

  it('genera un client_id único por serie', async () => {
    await enqueueSet(entry())
    await enqueueSet(entry({ setIndex: 1 }))
    const all = await db.pendingSets.toArray()
    expect(all).toHaveLength(2)
    expect(new Set(all.map((r) => r.clientId)).size).toBe(2)
  })

  it('vaciar la cola marca los registros como sincronizados', async () => {
    await enqueueSet(entry())
    const client = okClient()
    const out = await flushQueue(client)
    expect(out.synced).toBe(1)
    expect(out.failed).toBe(0)
    expect(await pendingCount()).toBe(0)
  })

  it('si el servidor falla los registros siguen pendientes', async () => {
    await enqueueSet(entry())
    const out = await flushQueue(failClient())
    expect(out.failed).toBe(1)
    expect(out.synced).toBe(0)
    expect(await pendingCount()).toBe(1)
  })

  it('reintentar tras un fallo no duplica: el client_id se conserva', async () => {
    await enqueueSet(entry())
    const before = (await db.pendingSets.toArray())[0]!.clientId

    await flushQueue(failClient())

    const client = okClient()
    await flushQueue(client)

    const sent = client.upsertSetLogs.mock.calls[0]![0] as { client_id: string }[]
    expect(sent[0]!.client_id).toBe(before)
    expect(await pendingCount()).toBe(0)
  })

  it('actualizar la misma serie reemplaza, no acumula', async () => {
    await enqueueSet(entry({ reps: 8 }))
    await enqueueSet(entry({ reps: 10 }))
    const all = await db.pendingSets.toArray()
    expect(all).toHaveLength(1)
    expect(all[0]!.reps).toBe(10)
  })

  it('actualizar una serie conserva su client_id original', async () => {
    await enqueueSet(entry({ reps: 8 }))
    const first = (await db.pendingSets.toArray())[0]!.clientId
    await enqueueSet(entry({ reps: 10 }))
    expect((await db.pendingSets.toArray())[0]!.clientId).toBe(first)
  })

  it('editar una serie ya sincronizada la vuelve a marcar como pendiente', async () => {
    await enqueueSet(entry({ reps: 8 }))
    await flushQueue(okClient())
    expect(await pendingCount()).toBe(0)

    await enqueueSet(entry({ reps: 10 }))
    expect(await pendingCount()).toBe(1)
  })

  it('vaciar una cola vacía no llama al servidor', async () => {
    const client = okClient()
    const out = await flushQueue(client)
    expect(client.upsertSetLogs).not.toHaveBeenCalled()
    expect(out.synced).toBe(0)
  })

  it('manda las series en el formato de la tabla, con snake_case', async () => {
    await enqueueSet(entry())
    const client = okClient()
    await flushQueue(client)
    const sent = client.upsertSetLogs.mock.calls[0]![0] as Record<string, unknown>[]
    expect(sent[0]).toMatchObject({
      session_id: 's1',
      program_exercise_id: 'pe1',
      set_index: 0,
      done: true,
      weight: 60,
      reps: 10,
      duration_seconds: null,
    })
    expect(sent[0]).toHaveProperty('client_id')
    expect(sent[0]).not.toHaveProperty('sessionId')
  })

  it('sube en lotes de 50 como máximo', async () => {
    for (let i = 0; i < 120; i++) await enqueueSet(entry({ setIndex: i }))
    const client = okClient()
    const out = await flushQueue(client)
    expect(out.synced).toBe(120)
    expect(client.upsertSetLogs).toHaveBeenCalledTimes(3)
    for (const call of client.upsertSetLogs.mock.calls) {
      expect((call[0] as unknown[]).length).toBeLessThanOrEqual(50)
    }
  })

  it('si un lote falla, los demás sí se suben', async () => {
    for (let i = 0; i < 60; i++) await enqueueSet(entry({ setIndex: i }))
    const client = {
      ...okClient(),
      upsertSetLogs: vi
        .fn()
        .mockResolvedValueOnce({ error: new Error('falla el primero') })
        .mockResolvedValueOnce({ error: null }),
    }
    const out = await flushQueue(client)
    expect(out.synced).toBe(10)
    expect(out.failed).toBe(50)
    expect(await pendingCount()).toBe(50)
  })

  it('dos vaciados simultáneos no envían el mismo registro dos veces', async () => {
    await enqueueSet(entry())
    const client = okClient()
    const [a, b] = await Promise.all([flushQueue(client), flushQueue(client)])
    expect(a.synced + b.synced).toBe(1)
    expect(client.upsertSetLogs).toHaveBeenCalledTimes(1)
  })
})
