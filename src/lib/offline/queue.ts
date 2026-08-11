import { db, type PendingSession, type PendingSet } from './db'

const BATCH_SIZE = 50

export type SessionRow = {
  id: string
  user_id: string
  program_day_id: string
  performed_on: string
  started_at: string
  completed_at: string | null
  session_rpe: number | null
  notes: string | null
}

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
  /** Crea o actualiza la sesión con el id que decidió el móvil. */
  upsertSessions: (rows: SessionRow[]) => Promise<{ error: unknown }>
  /**
   * El id que ya tiene la base para ese día. Se consulta solo cuando el alta
   * choca con la restricción única, es decir, cuando otro dispositivo se
   * adelantó a crear la misma sesión.
   */
  findSessionId: (
    userId: string,
    programDayId: string,
    performedOn: string,
  ) => Promise<string | null>
}

function toSessionRow(s: PendingSession): SessionRow {
  return {
    id: s.id,
    user_id: s.userId,
    program_day_id: s.programDayId,
    performed_on: s.performedOn,
    started_at: s.startedAt,
    completed_at: s.completedAt,
    session_rpe: s.sessionRpe,
    notes: s.notes,
  }
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

// --- Sesiones ---------------------------------------------------------------

/** La sesión de ese día, esté subida o no. */
export async function getLocalSession(
  programDayId: string,
  performedOn: string,
): Promise<PendingSession | undefined> {
  return db.pendingSessions
    .where('[programDayId+performedOn]')
    .equals([programDayId, performedOn])
    .first()
}

export async function saveLocalSession(session: PendingSession): Promise<void> {
  await db.pendingSessions.put(session)
}

/** Cambios sobre la sesión ya empezada: cerrarla, su esfuerzo, sus notas. */
export async function patchLocalSession(
  id: string,
  patch: Partial<Omit<PendingSession, 'id'>>,
): Promise<void> {
  await db.transaction('rw', db.pendingSessions, async () => {
    const current = await db.pendingSessions.get(id)
    if (!current) return
    await db.pendingSessions.put({ ...current, ...patch, synced: 0 })
  })
}

function isDuplicate(error: unknown): boolean {
  const e = error as { code?: string; message?: string }
  return e?.code === '23505' || /duplicate key|unique constraint/i.test(e?.message ?? '')
}

/**
 * Sube las sesiones creadas sin red.
 *
 * Devuelve los ids que NO llegaron: sus series se quedan en cola porque la
 * clave foránea las rechazaría.
 *
 * El caso interesante es el choque: la base ya tiene una sesión para ese día
 * porque se empezó desde otro dispositivo. Ahí gana la que ya existe y las
 * series de aquí se reapuntan a su id — perder el registro sería mucho peor que
 * perder el identificador local.
 */
export async function flushSessions(target: SyncTarget): Promise<Set<string>> {
  const pending = await db.pendingSessions.where('synced').equals(0).toArray()
  const blocked = new Set<string>()

  for (const session of pending) {
    const { error } = await target.upsertSessions([toSessionRow(session)])

    if (!error) {
      await db.pendingSessions.put({ ...session, synced: 1 })
      continue
    }

    if (!isDuplicate(error)) {
      blocked.add(session.id)
      continue
    }

    const remoteId = await target
      .findSessionId(session.userId, session.programDayId, session.performedOn)
      .catch(() => null)

    if (!remoteId || remoteId === session.id) {
      blocked.add(session.id)
      continue
    }

    await db.transaction('rw', db.pendingSets, db.pendingSessions, async () => {
      const mine = await db.pendingSets.where('sessionId').equals(session.id).toArray()
      await db.pendingSets.bulkPut(mine.map((s) => ({ ...s, sessionId: remoteId })))
      await db.pendingSessions.delete(session.id)
      await db.pendingSessions.put({ ...session, id: remoteId, synced: 1 })
    })
  }

  return blocked
}

/**
 * Sube lo pendiente. Nunca lanza: si no hay red, los registros se quedan en
 * cola y el próximo intento los recoge.
 *
 * Marca los registros como "en vuelo" dentro de una transacción antes de tocar
 * la red, para que dos vaciados concurrentes no manden lo mismo dos veces.
 */
export async function flushQueue(target: SyncTarget): Promise<{ synced: number; failed: number }> {
  // Primero las sesiones: una serie sin su sesión en la base no tiene dónde
  // colgarse.
  const blocked = await flushSessions(target)

  const claimed = await db.transaction('rw', db.pendingSets, async () => {
    const pending = (await db.pendingSets.where('synced').equals(0).toArray()).filter(
      (p) => !blocked.has(p.sessionId),
    )
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
