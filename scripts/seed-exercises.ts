/**
 * Siembra el catálogo de ejercicios desde Free Exercise DB.
 *
 * Es idempotente a propósito: correrlo dos veces no duplica filas ni vuelve a
 * subir imágenes. Usa la clave de servicio porque inserta ejercicios globales
 * (owner_id nulo), que las políticas prohíben crear desde el cliente.
 *
 * Dataset: https://github.com/yuhonas/free-exercise-db (Unlicense).
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. ' +
      'Copia .env.example a .env.local y llénalo con la salida de `pnpm supabase status`.',
  )
}

const DATASET_URL =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json'
const IMAGE_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const BUCKET = 'exercise-images'

const ROW_CHUNK = 200
const IMAGE_PARALLEL = 8

/**
 * La forma real del dataset, verificada contra los 873 registros: todas las
 * claves están presentes en todos ellos, así que los opcionales son por
 * prudencia ante un cambio futuro del origen, no por huecos actuales.
 */
type RawExercise = {
  id: string
  name: string
  category?: string | null
  equipment?: string | null
  force?: string | null
  level?: string | null
  mechanic?: string | null
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  instructions?: string[]
  images?: string[]
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/**
 * Valida lo mínimo antes de sembrar: que sea un arreglo y que cada registro
 * traiga `id` y `name` como texto. El resto de campos son opcionales en el
 * tipo, así que un origen que cambie de forma falla aquí con un mensaje claro
 * en vez de llenar la tabla de filas rotas.
 */
function assertDataset(value: unknown): asserts value is RawExercise[] {
  if (!Array.isArray(value)) {
    throw new Error('El dataset no es un arreglo')
  }
  if (value.length === 0) {
    throw new Error('El dataset vino vacío')
  }

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`El registro ${index} no es un objeto`)
    }
    const record = entry as Record<string, unknown>
    if (typeof record.id !== 'string' || record.id.length === 0) {
      throw new Error(`El registro ${index} no trae un id de texto`)
    }
    if (typeof record.name !== 'string' || record.name.length === 0) {
      throw new Error(`El registro ${index} (${record.id}) no trae un name de texto`)
    }
  }
}

async function fetchDataset(): Promise<RawExercise[]> {
  const response = await fetch(DATASET_URL)
  if (!response.ok) {
    throw new Error(`El dataset respondió ${response.status}`)
  }

  const payload: unknown = await response.json()
  assertDataset(payload)
  return payload
}

type ImageOutcome = 'subida' | 'ya-estaba' | 'fallo'

/**
 * Storage devuelve el conflicto con campos estructurados. Se miran esos y no
 * el texto del mensaje: el texto cambia entre versiones y clasificar mal un
 * "ya existe" como fallo hace que el script salga con error en cada reejecución.
 */
function isAlreadyThere(error: { message: string } & Record<string, unknown>): boolean {
  return (
    error.code === 'KeyAlreadyExists' ||
    error.statusCode === '409' ||
    error.message.toLowerCase().includes('already exists')
  )
}

const RETRIES = 2
const RETRY_DELAY_MS = 1500

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sube una imagen si no está ya. Se intenta la subida directamente en vez de
 * preguntar antes si existe: preguntar duplicaría las peticiones, y son 1746.
 *
 * Reintenta los fallos transitorios porque en una corrida de este tamaño el
 * gateway de Storage agota tiempo alguna vez ("The upstream server is timing
 * out"). Sin reintento, una corrida perfectamente buena termina en rojo.
 *
 * Coste conocido: al reejecutar se vuelve a descargar cada imagen del origen
 * antes de descubrir que ya estaba. Son ~66 MB. Se acepta porque el caso
 * normal es una base recién creada donde todo se sube de todos modos, y
 * evitarlo costaría una consulta por carpeta, 873 en total.
 */
async function uploadImage(path: string): Promise<ImageOutcome> {
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    if (attempt > 0) await wait(RETRY_DELAY_MS * attempt)

    let response: Response
    try {
      response = await fetch(`${IMAGE_BASE}/${path}`)
    } catch (error) {
      if (attempt === RETRIES) {
        console.warn(`  ${path}: no se pudo descargar (${String(error)})`)
        return 'fallo'
      }
      continue
    }

    if (!response.ok) {
      if (attempt === RETRIES) {
        console.warn(`  ${path}: el origen respondió ${response.status}`)
        return 'fallo'
      }
      continue
    }

    const body = new Uint8Array(await response.arrayBuffer())
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: response.headers.get('content-type') ?? 'image/jpeg',
      upsert: false,
    })

    if (!error) return 'subida'
    if (isAlreadyThere(error as never)) return 'ya-estaba'

    if (attempt === RETRIES) {
      console.warn(`  ${path}: no se pudo subir (${error.message})`)
      return 'fallo'
    }
  }

  return 'fallo'
}

async function main() {
  console.log('Descargando el dataset…')
  const raw = await fetchDataset()
  console.log(`  ${raw.length} ejercicios`)

  const rows = raw.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    category: exercise.category ?? null,
    equipment: exercise.equipment ?? null,
    force: exercise.force ?? null,
    level: exercise.level ?? null,
    mechanic: exercise.mechanic ?? null,
    primary_muscles: exercise.primaryMuscles ?? [],
    secondary_muscles: exercise.secondaryMuscles ?? [],
    instructions: exercise.instructions ?? [],
    image_paths: exercise.images ?? [],
    owner_id: null,
  }))

  console.log('Insertando filas…')
  for (let index = 0; index < rows.length; index += ROW_CHUNK) {
    const chunk = rows.slice(index, index + ROW_CHUNK)
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(`Fallo al insertar el lote ${index}: ${error.message}`)
    console.log(`  ${Math.min(index + ROW_CHUNK, rows.length)}/${rows.length}`)
  }

  const paths = raw.flatMap((exercise) => exercise.images ?? [])
  console.log(`Subiendo ${paths.length} imágenes…`)

  const tally: Record<ImageOutcome, number> = { subida: 0, 'ya-estaba': 0, fallo: 0 }

  for (let index = 0; index < paths.length; index += IMAGE_PARALLEL) {
    const batch = paths.slice(index, index + IMAGE_PARALLEL)
    const outcomes = await Promise.all(batch.map(uploadImage))
    for (const outcome of outcomes) tally[outcome] += 1

    const done = Math.min(index + IMAGE_PARALLEL, paths.length)
    if (done % 200 < IMAGE_PARALLEL || done === paths.length) {
      console.log(
        `  ${done}/${paths.length} — ${tally.subida} subidas, ${tally['ya-estaba']} ya estaban, ${tally.fallo} fallidas`,
      )
    }
  }

  console.log(
    `\nListo. ${rows.length} ejercicios en la base. ` +
      `Imágenes: ${tally.subida} subidas, ${tally['ya-estaba']} ya estaban, ${tally.fallo} fallidas.`,
  )

  if (tally.fallo > 0) {
    console.warn(
      'Algunas imágenes fallaron. Volver a correr el script reintenta solo esas.',
    )
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
