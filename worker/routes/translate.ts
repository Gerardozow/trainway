import { getExercise } from '@/lib/catalog'
import type { ExerciseTranslation } from '@/lib/supabase/types'
import { HttpError, json, type Env } from '../lib/auth'
import { db } from '../lib/supabase'
import { callStructured, createMinimax } from '../lib/minimax'
import { TRANSLATE_SYSTEM_PROMPT } from '../lib/prompt'
import { TRANSLATE_TOOL_NAME, TRANSLATE_TOOL_SCHEMA } from '../lib/schemas'

const MAX_PER_CALL = 30

type Body = { exercise_ids?: string[]; locale?: string }

/**
 * Traduce los ejercicios que aún no estén en caché.
 *
 * La caché es compartida entre todos los usuarios: un ejercicio se paga una vez
 * en la vida del proyecto, no una vez por persona. Por eso escribe con service
 * role — `exercise_translations` no tiene política de escritura.
 */
export async function handleTranslate(req: Request, env: Env, token: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Body
  const locale = body.locale ?? 'es'
  const requested = (body.exercise_ids ?? []).filter((id) => getExercise(id))

  if (requested.length === 0) return json({ translated: 0, cached: 0 })

  const read = db(env, { token })
  const list = requested.map((id) => `"${id}"`).join(',')
  const existing = await read.select<ExerciseTranslation[]>(
    `exercise_translations?select=exercise_id&locale=eq.${locale}&exercise_id=in.(${list})`,
  )

  const known = new Set(existing.map((t) => t.exercise_id))
  const missing = requested.filter((id) => !known.has(id)).slice(0, MAX_PER_CALL)

  if (missing.length === 0) return json({ translated: 0, cached: known.size })

  const payload = missing.map((id) => {
    const e = getExercise(id)!
    return { exercise_id: id, name: e.name, instructions: e.instructions }
  })

  const client = createMinimax(env.MINIMAX_API_KEY)
  const raw = (await callStructured(client, {
    system: TRANSLATE_SYSTEM_PROMPT,
    user: `Traduce estos ejercicios al español de México. Devuelve el mismo exercise_id sin modificar.

${JSON.stringify(payload, null, 1)}`,
    toolName: TRANSLATE_TOOL_NAME,
    toolSchema: TRANSLATE_TOOL_SCHEMA,
    maxTokens: 8000,
  })) as { translations?: unknown }

  const rows = Array.isArray(raw.translations) ? raw.translations : []
  const valid = rows.filter(
    (t): t is ExerciseTranslation =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as ExerciseTranslation).exercise_id === 'string' &&
      typeof (t as ExerciseTranslation).name === 'string' &&
      getExercise((t as ExerciseTranslation).exercise_id) !== undefined,
  )

  if (valid.length === 0) throw new HttpError('La traducción no devolvió nada usable.', 502)

  const service = db(env, { service: true })
  await service.upsert(
    'exercise_translations',
    valid.map((t) => ({
      exercise_id: t.exercise_id,
      locale,
      name: t.name,
      instructions: Array.isArray(t.instructions) ? t.instructions : [],
    })),
    'exercise_id,locale',
  )

  return json({ translated: valid.length, cached: known.size })
}
