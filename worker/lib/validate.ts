import { parseRepRange } from '@/lib/progression'
import type { Exercise } from '@/lib/catalog'
import type { AiDay, AiExercise, AiPlan } from './schemas'

/**
 * Valida y repara la salida de MiniMax.
 *
 * Sin esta capa el modelo devuelve ejercicios plausibles que no existen en el
 * catálogo — "Cable Crossover Reverso" — y el plan queda con huecos donde
 * debería ir la imagen. La regla es dura: si el id no está entre los candidatos
 * que le dimos, no entra.
 *
 * Ninguna función de aquí lanza excepciones. La entrada es texto de un modelo:
 * puede ser cualquier cosa.
 */

export type ValidationResult =
  | { ok: true; plan: AiPlan }
  | { ok: false; errors: string[] }

/** "30 s" · "45seg" · "1 min" · "2 minutos" -> segundos. Null si no es tiempo. */
function parseDurationText(text: string): number | null {
  const m = /^(\d+)\s*(s|seg|segs|segundos?|m|min|mins|minutos?)$/i.exec(text.trim())
  if (!m) return null
  const n = Number(m[1])
  return /^m/i.test(m[2]!) ? n * 60 : n
}

/**
 * Coerciones seguras antes de validar.
 *
 * El modelo prescribe isométricos como `reps: "30 s"`, que es correcto para un
 * entrenador y no encaja en el esquema. Convertirlo a `duration_seconds` es
 * inequívoco, así que se hace en vez de tumbar un bloque de cuatro días por un
 * solo ejercicio. Solo se normaliza lo que no admite otra lectura.
 */
export function normalizePlan(raw: unknown): unknown {
  if (!isObject(raw) || !Array.isArray(raw.days)) return raw

  for (const day of raw.days) {
    if (!isObject(day) || !Array.isArray(day.exercises)) continue

    for (const ex of day.exercises) {
      if (!isObject(ex)) continue

      // Sin descanso declarado no hay nada que interpretar mal: el plan trae un
      // hueco y hay que taparlo. Se tumbaba el bloque entero por esto.
      if (typeof ex.rest_seconds !== 'number' || !Number.isFinite(ex.rest_seconds)) {
        ex.rest_seconds = DEFAULT_REST_SECONDS
      }

      if (typeof ex.reps !== 'string') continue

      const seconds = parseDurationText(ex.reps)
      if (seconds === null) continue

      ex.duration_seconds ??= seconds
      ex.reps = null
    }
  }

  return raw
}

const SCHEMES = new Set(['double', 'linear', 'time', 'intensity'])

/** Lo que se pone cuando el plan no dice cuánto descansar. Ni corto ni largo. */
const DEFAULT_REST_SECONDS = 90

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateExercise(
  raw: unknown,
  allowed: Set<string>,
  where: string,
  errors: string[],
): void {
  if (!isObject(raw)) {
    errors.push(`${where}: no es un objeto`)
    return
  }

  const id = raw.exercise_id
  if (typeof id !== 'string' || id.length === 0) {
    errors.push(`${where}: falta exercise_id`)
  } else if (!allowed.has(id)) {
    errors.push(`${where}: exercise_id "${id}" no está entre los candidatos`)
  }

  const sets = raw.sets
  if (typeof sets !== 'number' || !Number.isInteger(sets) || sets < 1 || sets > 8) {
    errors.push(`${where}: sets debe ser un entero de 1 a 8, llegó ${JSON.stringify(sets)}`)
  }

  /*
   * Cero es una respuesta válida, no un error.
   *
   * El modelo cierra la sesión con quince minutos de cinta y le pone
   * `rest_seconds: 0`, que es exactamente lo que hace un entrenador: después
   * del último ejercicio no se descansa, te vas a casa. Exigir 30 como mínimo
   * tumbaba el bloque de cuatro semanas entero por eso, y la reparación no lo
   * arregla porque solo sustituye ejercicios inválidos, no números.
   */
  const rest = raw.rest_seconds
  const restOk = typeof rest === 'number' && (rest === 0 || (rest >= 30 && rest <= 300))
  if (!restOk) {
    errors.push(`${where}: rest_seconds debe ser 0 o estar entre 30 y 300, llegó ${JSON.stringify(rest)}`)
  }

  // reps puede ser null solo si hay duración (cardio o isométrico).
  const reps = raw.reps
  const duration = raw.duration_seconds
  if (reps === null || reps === undefined) {
    if (typeof duration !== 'number' || duration <= 0) {
      errors.push(`${where}: sin reps hace falta duration_seconds`)
    }
  } else if (typeof reps !== 'string' || parseRepRange(reps) === null) {
    errors.push(`${where}: reps "${String(reps)}" no es un rango válido ("8-10" o "12")`)
  }

  const prog = raw.progression
  if (!isObject(prog) || typeof prog.type !== 'string' || !SCHEMES.has(prog.type)) {
    errors.push(`${where}: progression.type inválido, llegó ${JSON.stringify(prog)}`)
  }

  const rpe = raw.target_rpe
  if (rpe !== null && rpe !== undefined && (typeof rpe !== 'number' || rpe < 1 || rpe > 10)) {
    errors.push(`${where}: target_rpe fuera de 1..10`)
  }
}

function validateDay(raw: unknown, allowed: Set<string>, index: number, errors: string[]): number | null {
  const where = `día ${index + 1}`
  if (!isObject(raw)) {
    errors.push(`${where}: no es un objeto`)
    return null
  }

  const dayIndex = raw.day_index
  if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > 7) {
    errors.push(`${where}: day_index debe ser un entero de 1 a 7`)
  }

  if (typeof raw.title !== 'string' || raw.title.trim() === '') {
    errors.push(`${where}: falta el título`)
  }

  const exercises = raw.exercises
  if (!Array.isArray(exercises) || exercises.length < 3 || exercises.length > 8) {
    errors.push(`${where}: debe tener entre 3 y 8 ejercicios, llegaron ${
      Array.isArray(exercises) ? exercises.length : 'ninguno'
    }`)
  } else {
    exercises.forEach((e, i) => validateExercise(e, allowed, `${where}, ejercicio ${i + 1}`, errors))
  }

  return typeof dayIndex === 'number' ? dayIndex : null
}

export function validatePlan(raw: unknown, candidateIds: string[]): ValidationResult {
  const errors: string[] = []
  const allowed = new Set(candidateIds)

  if (!isObject(raw)) return { ok: false, errors: ['La respuesta no es un objeto JSON'] }

  if (typeof raw.block_name !== 'string' || raw.block_name.trim() === '') {
    errors.push('Falta block_name')
  }
  if (typeof raw.rationale !== 'string') {
    errors.push('Falta rationale')
  }

  const days = raw.days
  if (!Array.isArray(days) || days.length < 2 || days.length > 7) {
    errors.push(`days debe tener entre 2 y 7 entradas, llegaron ${Array.isArray(days) ? days.length : 'ninguna'}`)
    return { ok: false, errors }
  }

  const seen = new Set<number>()
  days.forEach((d, i) => {
    const dayIndex = validateDay(d, allowed, i, errors)
    if (dayIndex !== null) {
      if (seen.has(dayIndex)) errors.push(`day_index ${dayIndex} está repetido`)
      seen.add(dayIndex)
    }
  })

  return errors.length === 0 ? { ok: true, plan: raw as unknown as AiPlan } : { ok: false, errors }
}

/**
 * Último recurso cuando el modelo reincide tras el reintento: sustituye cada id
 * inválido por el candidato más cercano — mismo músculo primario del día si lo
 * hay, y sin repetir lo que ya está en ese día.
 *
 * Preferimos un plan con un ejercicio subóptimo a no darle nada al usuario.
 */
export function repairPlan(plan: AiPlan, candidates: Exercise[]): AiPlan {
  const valid = new Set(candidates.map((c) => c.id))

  const days: AiDay[] = plan.days.map((day) => {
    const used = new Set(day.exercises.map((e) => e.exercise_id).filter((id) => valid.has(id)))
    const focus = new Set(day.focus)

    const exercises: AiExercise[] = day.exercises.map((ex) => {
      if (valid.has(ex.exercise_id)) return ex

      const pool = candidates.filter((c) => !used.has(c.id))
      const substitute =
        pool.find((c) => c.primaryMuscles.some((m) => focus.has(m)) && c.mechanic === 'compound') ??
        pool.find((c) => c.primaryMuscles.some((m) => focus.has(m))) ??
        pool[0]

      if (!substitute) return ex
      used.add(substitute.id)
      return { ...ex, exercise_id: substitute.id }
    })

    return { ...day, exercises }
  })

  return { ...plan, days }
}
