import { db, type PendingSet } from './db'

const BATCH_SIZE = 50

export type SetLogRow = {
  session_id: string
  program_exercise_id: string
  set_index: number
  done: boolean
  weight: number | null
  reps: number | null
  duration_seconds: number | null
  distance_m: number | null
  intensity: string | null
  rpe: number | null
  note: string | null
  client_id: string
  logged_at: string
}

/** Lo mínimo que la cola necesita del cliente de Supabase. Facilita el test. */
export type SyncTarget = {
  upsertSetLogs: (rows: SetLogRow[]) => Promise<{ error: unknown }>
}

function toRow(p: PendingSet): SetLogRow {
  return {
    session_id: p.sessionId,
    program_exercise_id: p.programExerciseId,
    set_index: p.setIndex,
    done: p.done,
    weight: p.weight,
    reps: p.reps,
    duration_seconds: p.durationSeconds,
    distance_m: p.distanceM,
    intensity: p.intensity,
    rpe: p.rpe,
    note: p.note,
    client_id: p.clientId,
    logged_at: p.loggedAt,
  }
}

/**
 * Escribe una serie en local. Siempre local primero: la UI no espera a la red.
 *
 * Si la serie ya existía, se actualizan sus valores pero se CONSERVA el
 * clientId. Ese detalle es lo que hace que un reintento tras un corte de señal
 * no acabe creando dos filas en la base.
 */
export async function enqueueSet(entry: Omit<PendingSet, 'clientId' | 'synced'>): Promise<string> {
  const key: [string, string, number] = [entry.sessionId, entry.programExerciseId, entry.setIndex]

  return db.transaction('rw', db.pendingSets, async () => {
    const existing = await db.pendingSets
      .where('[sessionId+programExerciseId+setIndex]')
      .equals(key)
      .first()

    const clientId = existing?.clientId ?? crypto.randomUUID()
    await db.pendingSets.put({ ...entry, clientId, synced: 0 })
    return clientId
  })
}

/**
 * Sube lo pendiente. Nunca lanza: si no hay red, los registros se quedan en
 * cola y el próximo intento los recoge.
 *
 * Marca los registros como "en vuelo" dentro de una transacción antes de tocar
 * la red, para que dos vaciados concurrentes no manden lo mismo dos veces.
 */
export async function flushQueue(target: SyncTarget): Promise<{ synced: number; failed: number }> {
  const claimed = await db.transaction('rw', db.pendingSets, async () => {
    const pending = await db.pendingSets.where('synced').equals(0).toArray()
    if (pending.length === 0) return []
    await db.pendingSets.bulkPut(pending.map((p) => ({ ...p, synced: 1 })))
    return pending
  })

  if (claimed.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (let i = 0; i < claimed.length; i += BATCH_SIZE) {
    const batch = claimed.slice(i, i + BATCH_SIZE)
    const { error } = await target.upsertSetLogs(batch.map(toRow))

    if (error) {
      // Devolver el lote a la cola conservando su clientId.
      await db.pendingSets.bulkPut(batch.map((p) => ({ ...p, synced: 0 })))
      failed += batch.length
    } else {
      synced += batch.length
    }
  }

  return { synced, failed }
}

export async function pendingCount(): Promise<number> {
  return db.pendingSets.where('synced').equals(0).count()
}

/** Series de una sesión, vengan de la cola o ya sincronizadas. */
export async function localSetsForSession(sessionId: string): Promise<PendingSet[]> {
  return db.pendingSets.where('sessionId').equals(sessionId).toArray()
}
