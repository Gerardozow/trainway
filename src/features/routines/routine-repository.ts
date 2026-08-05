import { supabase } from '../../lib/supabase'
import type { Routine, RoutineExercise } from './routine-types'

const ROUTINE_COLUMNS = 'id, owner_id, name, description, created_at, updated_at'
const ITEM_COLUMNS =
  'id, routine_id, exercise_id, position, target_sets, target_reps, target_weight, notes'

type RoutineRow = {
  id: string
  owner_id: string
  name: string
  description?: string | null
  created_at: string
  updated_at: string
}

type ItemRow = {
  id: string
  routine_id: string
  exercise_id: string
  position: number
  target_sets?: number | null
  target_reps?: number | null
  target_weight?: number | null
  notes?: string | null
}

function toRoutine(row: RoutineRow): Routine {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toItem(row: ItemRow): RoutineExercise {
  return {
    id: row.id,
    routineId: row.routine_id,
    exerciseId: row.exercise_id,
    position: row.position,
    targetSets: row.target_sets ?? null,
    targetReps: row.target_reps ?? null,
    targetWeight: row.target_weight ?? null,
    notes: row.notes ?? null,
  }
}

export function validateRoutineName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Ponle un nombre a la rutina'
  if (trimmed.length > 80) return 'El nombre no puede pasar de 80 caracteres'
  return null
}

export async function fetchRoutines(): Promise<Routine[]> {
  const { data, error } = await supabase
    .from('routines')
    .select(ROUTINE_COLUMNS)
    .order('updated_at', { ascending: false })

  // No se propaga el mensaje del servidor: puede llevar detalles del esquema.
  if (error) throw new Error('No se pudieron cargar tus rutinas')

  return (data as RoutineRow[]).map(toRoutine)
}

export async function fetchRoutine(
  id: string,
): Promise<{ routine: Routine; exercises: RoutineExercise[] } | null> {
  const { data, error } = await supabase
    .from('routines')
    .select(ROUTINE_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error('No se pudo cargar la rutina')
  if (!data) return null

  const items = await supabase
    .from('routine_exercises')
    .select(ITEM_COLUMNS)
    .eq('routine_id', id)
    .order('position', { ascending: true })

  if (items.error) throw new Error('No se pudo cargar la rutina')

  return {
    routine: toRoutine(data as RoutineRow),
    exercises: (items.data as ItemRow[]).map(toItem),
  }
}

export async function createRoutine(
  ownerId: string,
  name: string,
): Promise<{ routine: Routine | null; error: string | null }> {
  const invalid = validateRoutineName(name)
  if (invalid) return { routine: null, error: invalid }

  const { data, error } = await supabase
    .from('routines')
    .insert({ id: crypto.randomUUID(), owner_id: ownerId, name: name.trim() })
    .select(ROUTINE_COLUMNS)
    .single()

  if (error) return { routine: null, error: 'No se pudo crear la rutina' }

  return { routine: toRoutine(data as RoutineRow), error: null }
}

export async function renameRoutine(
  id: string,
  name: string,
): Promise<{ error: string | null }> {
  const invalid = validateRoutineName(name)
  if (invalid) return { error: invalid }

  const { data, error } = await supabase
    .from('routines')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    // Sin select, una actualización que no toca ninguna fila devuelve
    // error null y parecería que guardó.
    .select('id')

  if (error || !data || data.length === 0) {
    return { error: 'No se pudo renombrar la rutina' }
  }

  return { error: null }
}

export async function deleteRoutine(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('routines')
    .delete()
    .eq('id', id)
    .select('id')

  if (error || !data || data.length === 0) {
    return { error: 'No se pudo borrar la rutina' }
  }

  return { error: null }
}

/**
 * Reemplaza la lista entera de ejercicios de una rutina.
 *
 * Pasa por la función `save_routine_exercises` y no por varios update porque
 * PostgREST ejecuta cada petición en su propia transacción: reordenar dos
 * ejercicios chocaría contra el índice único de posición a mitad de camino.
 */
export async function saveExercises(
  routineId: string,
  exercises: RoutineExercise[],
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('save_routine_exercises', {
    p_routine_id: routineId,
    p_items: exercises.map((item) => ({
      id: item.id,
      exercise_id: item.exerciseId,
      position: item.position,
      target_sets: item.targetSets,
      target_reps: item.targetReps,
      target_weight: item.targetWeight,
      notes: item.notes,
    })),
  })

  if (error) return { error: 'No se pudieron guardar los ejercicios' }

  return { error: null }
}
