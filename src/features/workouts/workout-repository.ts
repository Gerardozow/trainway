import { supabase } from '../../lib/supabase'
import type { Workout, WorkoutSet } from './workout-types'

/**
 * Los identificadores los genera el dispositivo antes de que la fila exista en
 * el servidor, así que la local y la remota son la misma desde el principio.
 * Eso es lo que permite que reintentar una subida ya aplicada no duplique nada.
 */
export async function pushWorkout(workout: Workout): Promise<void> {
  // upsert y no insert: `workouts` sí tiene grant de UPDATE, y la operación
  // `finish` necesita modificar ended_at más tarde.
  const { error } = await supabase.from('workouts').upsert(
    {
      id: workout.id,
      user_id: workout.userId,
      routine_id: workout.routineId,
      started_at: workout.startedAt,
      ended_at: workout.endedAt,
      notes: workout.notes,
    },
    { onConflict: 'id' },
  )

  if (error) throw new Error(`${error.code ?? ''} ${error.message}`)
}

export async function pushSet(set: WorkoutSet): Promise<void> {
  // insert y no upsert: `workout_sets` no tiene grant de UPDATE a propósito,
  // así que un upsert sobre una fila existente daría 42501 en vez del 23505
  // que la cola sabe interpretar como "ya estaba subida". Con insert, el
  // reintento de algo ya aplicado produce exactamente ese conflicto de clave.
  const { error } = await supabase.from('workout_sets').insert({
    id: set.id,
    workout_id: set.workoutId,
    exercise_id: set.exerciseId,
    set_index: set.setIndex,
    reps: set.reps,
    weight: set.weight,
    rpe: set.rpe,
    is_warmup: set.isWarmup,
    completed_at: set.completedAt,
  })

  if (error) throw new Error(`${error.code ?? ''} ${error.message}`)
}

export async function pushFinish(input: {
  id: string
  endedAt: string
}): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ ended_at: input.endedAt })
    .eq('id', input.id)

  if (error) throw new Error(`${error.code ?? ''} ${error.message}`)
}

export async function pushDeleteSet(input: { id: string }): Promise<void> {
  const { error } = await supabase.from('workout_sets').delete().eq('id', input.id)
  if (error) throw new Error(`${error.code ?? ''} ${error.message}`)
}
