import { db } from '../../lib/db'
import type { PendingKind, Workout, WorkoutSet } from './workout-types'

/**
 * Los mismos topes que los CHECK de `workout_sets` en la migración 0007. Se
 * validan aquí y no solo en el servidor porque una serie que la base va a
 * rechazar no debe llegar a guardarse local: quedaría en la cola de
 * sincronización rebotando para siempre, y la cola se detiene en el primer
 * fallo, así que atorarían también todas las series posteriores.
 */
const MAX_REPS = 1000
const MAX_WEIGHT = 1000

function newId(): string {
  return crypto.randomUUID()
}

async function enqueue(kind: PendingKind, payload: unknown): Promise<void> {
  await db.syncQueue.add({
    id: newId(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  })
}

export async function startWorkout(
  userId: string,
  routineId: string | null = null,
): Promise<Workout> {
  const workout: Workout = {
    id: newId(),
    userId,
    routineId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    notes: null,
  }

  await db.transaction('rw', db.workouts, db.syncQueue, async () => {
    await db.workouts.add(workout)
    await enqueue('workout', workout)
  })

  return workout
}

export async function getActiveWorkout(): Promise<Workout | null> {
  const open = await db.workouts.filter((workout) => workout.endedAt === null).toArray()
  if (open.length === 0) return null

  // Si por lo que sea quedara más de uno abierto, manda el más reciente.
  return open.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

export async function addSet(input: {
  workoutId: string
  exerciseId: string
  reps: number
  weight: number
  rpe?: number | null
  isWarmup?: boolean
}): Promise<WorkoutSet> {
  if (!Number.isInteger(input.reps) || input.reps <= 0 || input.reps > MAX_REPS) {
    throw new Error(`Las repeticiones tienen que ser un entero entre 1 y ${MAX_REPS}`)
  }
  if (
    !Number.isFinite(input.weight) ||
    input.weight < 0 ||
    input.weight > MAX_WEIGHT
  ) {
    throw new Error(`El peso tiene que estar entre 0 y ${MAX_WEIGHT} kg`)
  }
  if (input.rpe != null && (input.rpe < 1 || input.rpe > 10)) {
    throw new Error('El RPE tiene que estar entre 1 y 10')
  }

  const sameExercise = await db.workoutSets
    .where('workoutId')
    .equals(input.workoutId)
    .filter((set) => set.exerciseId === input.exerciseId)
    .count()

  const set: WorkoutSet = {
    id: newId(),
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    setIndex: sameExercise,
    reps: input.reps,
    weight: input.weight,
    rpe: input.rpe ?? null,
    isWarmup: input.isWarmup ?? false,
    completedAt: new Date().toISOString(),
  }

  await db.transaction('rw', db.workoutSets, db.syncQueue, async () => {
    await db.workoutSets.add(set)
    await enqueue('set', set)
  })

  return set
}

export async function removeSet(setId: string): Promise<void> {
  await db.transaction('rw', db.workoutSets, db.syncQueue, async () => {
    await db.workoutSets.delete(setId)
    await enqueue('deleteSet', { id: setId })
  })
}

/**
 * `completedAt` tiene precisión de milisegundo, así que dos series registradas
 * muy seguidas pueden empatar. Como los identificadores son aleatorios, sin
 * desempate el orden en pantalla sería impredecible entre recargas. Se desempata
 * por ejercicio y número de serie, que sí son estables.
 */
function byTime(a: WorkoutSet, b: WorkoutSet): number {
  const byInstant = a.completedAt.localeCompare(b.completedAt)
  if (byInstant !== 0) return byInstant

  const byExercise = a.exerciseId.localeCompare(b.exerciseId)
  if (byExercise !== 0) return byExercise

  return a.setIndex - b.setIndex
}

export async function getSetsFor(workoutId: string): Promise<WorkoutSet[]> {
  const sets = await db.workoutSets.where('workoutId').equals(workoutId).toArray()
  return sets.sort(byTime)
}

/** Todas las series guardadas, para calcular qué se levantó la última vez. */
export async function allSets(): Promise<WorkoutSet[]> {
  return db.workoutSets.toArray()
}

export async function finishWorkout(workoutId: string): Promise<void> {
  const endedAt = new Date().toISOString()

  await db.transaction('rw', db.workouts, db.syncQueue, async () => {
    await db.workouts.update(workoutId, { endedAt })
    await enqueue('finish', { id: workoutId, endedAt })
  })
}

export async function pendingCount(): Promise<number> {
  return db.syncQueue.count()
}
