import { supabase } from '../../lib/supabase'
import type { Exercise } from './exercise-types'

const COLUMNS =
  'id, name, category, equipment, force, level, mechanic, primary_muscles, secondary_muscles, instructions, image_paths'

const BUCKET = 'exercise-images'

type ExerciseRow = {
  id: string
  name: string
  category?: string | null
  equipment?: string | null
  force?: string | null
  level?: string | null
  mechanic?: string | null
  primary_muscles?: string[] | null
  secondary_muscles?: string[] | null
  instructions?: string[] | null
  image_paths?: string[] | null
}

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    category: row.category ?? null,
    equipment: row.equipment ?? null,
    force: row.force ?? null,
    level: row.level ?? null,
    mechanic: row.mechanic ?? null,
    primaryMuscles: row.primary_muscles ?? [],
    secondaryMuscles: row.secondary_muscles ?? [],
    instructions: row.instructions ?? [],
    imagePaths: row.image_paths ?? [],
  }
}

/**
 * Trae el catálogo entero. Son ~873 filas de texto: cabe de sobra en una sola
 * petición, y traerlo completo es lo que permite buscar en local sin ida y
 * vuelta al servidor por cada tecla.
 */
export async function fetchAllExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase.from('exercises').select(COLUMNS)

  if (error) {
    // El mensaje del servidor puede llevar detalles del esquema; no se propaga.
    throw new Error('No se pudo cargar el catálogo de ejercicios')
  }

  return (data as ExerciseRow[]).map(toExercise)
}

export function exerciseImageUrl(path: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}
