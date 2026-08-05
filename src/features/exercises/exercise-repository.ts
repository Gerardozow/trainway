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
 * Cuántas filas se piden por vuelta. PostgREST corta cualquier respuesta en
 * `max_rows` (1000 en config.toml) y no avisa de que truncó: devuelve las
 * primeras y ya. Pedir de a 500 y parar cuando llega una página incompleta
 * evita depender de ese límite.
 */
const PAGE_SIZE = 500

/**
 * Trae el catálogo entero, paginando.
 *
 * Son ~873 ejercicios globales más los propios de cada usuario. Sin paginar,
 * un usuario con 128 ejercicios propios pasaría de las 1000 filas del límite
 * de PostgREST y perdería parte del catálogo en silencio.
 *
 * Traerlo completo es lo que permite buscar en local sin ida y vuelta al
 * servidor por cada tecla.
 */
export async function fetchAllExercises(): Promise<Exercise[]> {
  const rows: ExerciseRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('exercises')
      .select(COLUMNS)
      // Un orden estable es obligatorio al paginar: sin él, dos páginas
      // pueden repetir filas y saltarse otras.
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      // El mensaje del servidor puede llevar detalles del esquema; no se propaga.
      throw new Error('No se pudo cargar el catálogo de ejercicios')
    }

    const page = (data ?? []) as ExerciseRow[]
    rows.push(...page)

    if (page.length < PAGE_SIZE) break
  }

  return rows.map(toExercise)
}

export function exerciseImageUrl(path: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}
