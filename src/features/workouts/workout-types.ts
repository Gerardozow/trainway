export type Workout = {
  id: string
  userId: string
  routineId: string | null
  startedAt: string
  endedAt: string | null
  notes: string | null
}

export type WorkoutSet = {
  id: string
  workoutId: string
  exerciseId: string
  setIndex: number
  reps: number
  weight: number
  rpe: number | null
  isWarmup: boolean
  completedAt: string
}

export type PendingKind = 'workout' | 'set' | 'finish' | 'deleteSet'

/**
 * Una operación que todavía no llegó al servidor. `attempts` y `lastError`
 * existen para poder decirle al usuario por qué algo lleva rato atorado, en
 * vez de dejar un contador de pendientes que nunca baja sin explicación.
 */
export type PendingOperation = {
  id: string
  kind: PendingKind
  payload: unknown
  createdAt: string
  attempts: number
  lastError: string | null
}
