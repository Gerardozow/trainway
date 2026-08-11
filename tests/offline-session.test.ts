import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import {
  clearLocal,
  db,
  enqueueSet,
  flushQueue,
  flushSessions,
  getLocalSession,
  patchLocalSession,
  pendingCount,
  saveLocalSession,
} from '@/lib/offline'
import type { PendingSession, PendingSet } from '@/lib/offline'

const session = (over: Partial<PendingSession> = {}): PendingSession => ({
  id: 'local-1',
  userId: 'u1',
  programDayId: 'pd1',
  performedOn: '2026-08-10',
  startedAt: '2026-08-10T18:00:00.000Z',
  completedAt: null,
  sessionRpe: null,
  notes: null,
  synced: 0,
  ...over,
})

const entry = (over: Partial<PendingSet> = {}): Omit<PendingSet, 'clientId' | 'synced'> => ({
  sessionId: 'local-1',
  programExerciseId: 'pe1',
  setIndex: 0,
  done: true,
  weight: 60,
  reps: 10,
  durationSeconds: null,
  distanceM: null,
  intensity: null,
  rpe: null,
  note: null,
  loggedAt: '2026-08-10T18:05:00.000Z',
  ...over,
})

const target = (over: Record<string, unknown> = {}) => ({
  upsertSetLogs: vi.fn().mockResolvedValue({ error: null }),
  upsertSessions: vi.fn().mockResolvedValue({ error: null }),
  findSessionId: vi.fn().mockResolvedValue(null),
  ...over,
})

const duplicado = { code: '23505', message: 'duplicate key value violates unique constraint' }

describe('sesión empezada sin red', () => {
  beforeEach(async () => {
    await clearLocal()
  })

  it('se guarda en local y se recupera por día y fecha', async () => {
    await saveLocalSession(session())
    const found = await getLocalSession('pd1', '2026-08-10')
    expect(found?.id).toBe('local-1')
    expect(found?.synced).toBe(0)
  })

  it('al subirla queda marcada como sincronizada', async () => {
    await saveLocalSession(session())
    const client = target()

    const blocked = await flushSessions(client)

    expect(blocked.size).toBe(0)
    expect(client.upsertSessions).toHaveBeenCalledOnce()
    expect((await getLocalSession('pd1', '2026-08-10'))?.synced).toBe(1)
  })

  it('sube la sesión ANTES que sus series', async () => {
    await saveLocalSession(session())
    await enqueueSet(entry())

    const order: string[] = []
    const client = target({
      upsertSessions: vi.fn(async () => {
        order.push('sesion')
        return { error: null }
      }),
      upsertSetLogs: vi.fn(async () => {
        order.push('series')
        return { error: null }
      }),
    })

    await flushQueue(client)
    expect(order).toEqual(['sesion', 'series'])
  })

  it('si la sesión no sube, sus series se quedan en la cola', async () => {
    await saveLocalSession(session())
    await enqueueSet(entry())

    const client = target({
      upsertSessions: vi.fn().mockResolvedValue({ error: new Error('sin red') }),
    })

    const out = await flushQueue(client)

    expect(client.upsertSetLogs).not.toHaveBeenCalled()
    expect(out.synced).toBe(0)
    expect(await pendingCount()).toBe(1)
  })

  it('las series de otras sesiones sí suben aunque una falle', async () => {
    await saveLocalSession(session())
    await saveLocalSession(session({ id: 'local-2', programDayId: 'pd2', synced: 1 }))
    await enqueueSet(entry())
    await enqueueSet(entry({ sessionId: 'local-2' }))

    const client = target({
      upsertSessions: vi.fn().mockResolvedValue({ error: new Error('sin red') }),
    })

    const out = await flushQueue(client)

    expect(out.synced).toBe(1)
    expect(client.upsertSetLogs.mock.calls[0]![0]).toHaveLength(1)
    expect(client.upsertSetLogs.mock.calls[0]![0][0].session_id).toBe('local-2')
  })

  it('si otro dispositivo creó la sesión antes, las series se reapuntan a la suya', async () => {
    await saveLocalSession(session())
    await enqueueSet(entry())

    const client = target({
      upsertSessions: vi.fn().mockResolvedValue({ error: duplicado }),
      findSessionId: vi.fn().mockResolvedValue('remota-9'),
    })

    const out = await flushQueue(client)

    // La sesión local desaparece a favor de la que ya existía...
    expect(await db.pendingSessions.get('local-1')).toBeUndefined()
    expect((await getLocalSession('pd1', '2026-08-10'))?.id).toBe('remota-9')

    // ...y la serie viaja con el id bueno, en esta misma pasada.
    expect(out.synced).toBe(1)
    expect(client.upsertSetLogs.mock.calls[0]![0][0].session_id).toBe('remota-9')
  })

  it('choque sin sesión remota localizable: no se pierde nada, se reintenta luego', async () => {
    await saveLocalSession(session())
    await enqueueSet(entry())

    const client = target({
      upsertSessions: vi.fn().mockResolvedValue({ error: duplicado }),
      findSessionId: vi.fn().mockResolvedValue(null),
    })

    await flushQueue(client)

    expect(await pendingCount()).toBe(1)
    expect((await getLocalSession('pd1', '2026-08-10'))?.synced).toBe(0)
  })

  it('cerrar la sesión la vuelve a poner en cola', async () => {
    await saveLocalSession(session({ synced: 1 }))
    await patchLocalSession('local-1', {
      completedAt: '2026-08-10T19:00:00.000Z',
      sessionRpe: 8,
      notes: 'el hombro molestó',
    })

    const stored = await getLocalSession('pd1', '2026-08-10')
    expect(stored?.synced).toBe(0)
    expect(stored?.sessionRpe).toBe(8)

    const client = target()
    await flushSessions(client)

    expect(client.upsertSessions.mock.calls[0]![0][0]).toMatchObject({
      completed_at: '2026-08-10T19:00:00.000Z',
      session_rpe: 8,
      notes: 'el hombro molestó',
    })
  })

  it('cerrar sesión en la app borra también las sesiones locales', async () => {
    await saveLocalSession(session())
    await clearLocal()
    expect(await getLocalSession('pd1', '2026-08-10')).toBeUndefined()
  })
})
