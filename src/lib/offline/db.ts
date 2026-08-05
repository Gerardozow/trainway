import Dexie, { type EntityTable } from 'dexie'
import type { DayWithExercises, SetLog } from '@/lib/supabase/types'

export type PendingSet = {
  sessionId: string
  programExerciseId: string
  setIndex: number
  done: boolean
  weight: number | null
  reps: number | null
  durationSeconds: number | null
  distanceM: number | null
  intensity: string | null
  rpe: number | null
  note: string | null
  loggedAt: string
  /** Idempotencia. Se genera una vez y NUNCA cambia, ni al editar la serie. */
  clientId: string
  /** 0 = pendiente, 1 = subido. Número porque Dexie no indexa booleanos. */
  synced: 0 | 1
}

/** El día hidratado antes de entrar al gimnasio, para funcionar sin señal. */
export type CachedDay = {
  programDayId: string
  day: DayWithExercises
  history: Record<string, SetLog[]>
  cachedAt: string
}

class TrainwayDB extends Dexie {
  pendingSets!: EntityTable<PendingSet, 'clientId'>
  cachedDays!: EntityTable<CachedDay, 'programDayId'>

  constructor() {
    super('trainway')
    this.version(1).stores({
      // La clave compuesta es lo que hace que reencolar la misma serie
      // reemplace en vez de acumular. `synced` está indexado para el flusher.
      pendingSets: '&clientId, [sessionId+programExerciseId+setIndex], synced, sessionId',
      cachedDays: '&programDayId, cachedAt',
    })
  }
}

export const db = new TrainwayDB()

export async function clearLocal(): Promise<void> {
  await Promise.all([db.pendingSets.clear(), db.cachedDays.clear()])
}
