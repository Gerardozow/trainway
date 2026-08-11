import Dexie, { type EntityTable } from 'dexie'
import type {
  DayWithExercises,
  ExerciseTranslation,
  Intake,
  Profile,
  SetLog,
} from '@/lib/supabase/types'

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

/**
 * La sesión de entrenamiento, con su id decidido en el móvil.
 *
 * `workout_sessions.id` es un uuid con valor por defecto en la base, pero nada
 * impide mandarlo desde aquí — y eso es justo lo que permite empezar a entrenar
 * sin señal: las series necesitan un `session_id` al que apuntar, y sin red no
 * hay forma de pedírselo al servidor.
 */
export type PendingSession = {
  id: string
  userId: string
  programDayId: string
  performedOn: string
  startedAt: string
  completedAt: string | null
  sessionRpe: number | null
  notes: string | null
  /** 0 = falta subirla, 1 = ya existe en la base. */
  synced: 0 | 1
}

/**
 * El día hidratado antes de entrar al gimnasio, para funcionar sin señal.
 *
 * Se guarda todo lo que la pantalla de sesión necesita, traducciones incluidas:
 * de poco sirve tener el entrenamiento si los ejercicios vuelven al inglés.
 */
export type CachedDay = {
  programDayId: string
  day: DayWithExercises
  history: Record<string, SetLog[]>
  translations?: Record<string, ExerciseTranslation>
  profile?: Profile | null
  intake?: Intake | null
  cachedAt: string
}

/** Lo que necesita la pantalla de Hoy, guardado tal cual se recibió. */
export type CachedToday = {
  userId: string
  payload: unknown
  cachedAt: string
}

class TrainwayDB extends Dexie {
  pendingSets!: EntityTable<PendingSet, 'clientId'>
  pendingSessions!: EntityTable<PendingSession, 'id'>
  cachedDays!: EntityTable<CachedDay, 'programDayId'>
  cachedToday!: EntityTable<CachedToday, 'userId'>

  constructor() {
    super('trainway')
    this.version(1).stores({
      // La clave compuesta es lo que hace que reencolar la misma serie
      // reemplace en vez de acumular. `synced` está indexado para el flusher.
      pendingSets: '&clientId, [sessionId+programExerciseId+setIndex], synced, sessionId',
      cachedDays: '&programDayId, cachedAt',
    })

    this.version(2).stores({
      pendingSets: '&clientId, [sessionId+programExerciseId+setIndex], synced, sessionId',
      pendingSessions: '&id, [programDayId+performedOn], synced',
      cachedDays: '&programDayId, cachedAt',
      cachedToday: '&userId, cachedAt',
    })
  }
}

export const db = new TrainwayDB()

export async function clearLocal(): Promise<void> {
  await Promise.all([
    db.pendingSets.clear(),
    db.pendingSessions.clear(),
    db.cachedDays.clear(),
    db.cachedToday.clear(),
  ])
}
