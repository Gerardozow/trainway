import { filterCandidates } from '@/lib/catalog'
import type { Intake, Program, ProgramDay } from '@/lib/supabase/types'
import { HttpError, json, type Env } from '../lib/auth'
import { db } from '../lib/supabase'
import { callStructured, createMinimax, MINIMAX_MODEL } from '../lib/minimax'
import { buildPlanPrompt, PLAN_SYSTEM_PROMPT } from '../lib/prompt'
import { PLAN_TOOL_NAME, PLAN_TOOL_SCHEMA, type AiPlan } from '../lib/schemas'
import { normalizePlan, repairPlan, validatePlan } from '../lib/validate'
import { expandBlock, BLOCK_WEEKS } from '../lib/expand'

const CANDIDATE_LIMIT = 60
const MAX_PLANS_PER_DAY = 10

type Body = { intake_id?: string; previous_review?: string | null }

/**
 * Genera un bloque de 4 semanas.
 *
 * El flujo entero está diseñado alrededor de una idea: la IA elige de una lista
 * cerrada y nunca inventa. Si aun así devuelve algo inválido, se reintenta una
 * vez con el error como contexto, y si reincide se repara con sustituciones.
 * Preferimos un ejercicio subóptimo a un plan roto.
 */
export async function handlePlan(req: Request, env: Env, userId: string, token: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Body
  if (!body.intake_id) throw new HttpError('Falta intake_id.', 400)

  const sql = db(env, { token })

  // Límite de tasa: 10 generaciones al día por usuario.
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const recent = await sql.select<Program[]>(
    `programs?select=id&user_id=eq.${userId}&created_at=gte.${since}`,
  )
  if (recent.length >= MAX_PLANS_PER_DAY) {
    throw new HttpError('Llegaste al límite de planes por hoy. Vuelve mañana.', 429)
  }

  const intakes = await sql.select<Intake[]>(
    `intakes?select=*&id=eq.${body.intake_id}&user_id=eq.${userId}`,
  )
  const intake = intakes[0]
  if (!intake) throw new HttpError('No encontramos ese cuestionario.', 404)

  const candidates = filterCandidates({
    equipment: intake.equipment,
    level: intake.experience,
    focusMuscles: intake.focus_muscles,
    includeCardio: intake.include_cardio,
    limit: CANDIDATE_LIMIT,
  })
  const candidateIds = candidates.map((c) => c.id)

  const previous = await sql.select<Program[]>(
    `programs?select=block_number&user_id=eq.${userId}&order=block_number.desc&limit=1`,
  )
  const blockNumber = (previous[0]?.block_number ?? 0) + 1

  const client = createMinimax(env.MINIMAX_API_KEY)
  const prompt = buildPlanPrompt({
    intake,
    candidates,
    blockNumber,
    previousReview: body.previous_review ?? null,
  })

  // Primer intento.
  let raw = await callStructured(client, {
    system: PLAN_SYSTEM_PROMPT,
    user: prompt,
    toolName: PLAN_TOOL_NAME,
    toolSchema: PLAN_TOOL_SCHEMA,
  })
  let result = validatePlan(normalizePlan(raw), candidateIds)

  // Segundo intento, devolviéndole exactamente qué hizo mal.
  if (!result.ok) {
    raw = await callStructured(client, {
      system: PLAN_SYSTEM_PROMPT,
      user: `${prompt}

Tu respuesta anterior tenía estos errores. Corrígelos:
${result.errors.map((e) => `- ${e}`).join('\n')}`,
      toolName: PLAN_TOOL_NAME,
      toolSchema: PLAN_TOOL_SCHEMA,
    })
    result = validatePlan(normalizePlan(raw), candidateIds)
  }

  // Reparación: sustituye lo inválido en vez de dejar al usuario sin plan.
  let plan: AiPlan
  if (result.ok) {
    plan = result.plan
  } else {
    const repaired = repairPlan(raw as AiPlan, candidates)
    const check = validatePlan(repaired, candidateIds)
    if (!check.ok) {
      throw new HttpError(
        'La IA no logró armar un plan válido. Inténtalo otra vez en un momento.',
        502,
      )
    }
    plan = check.plan
  }

  // --- Persistencia ---------------------------------------------------------
  await sql.patch(`programs?user_id=eq.${userId}&status=eq.active`, { status: 'completed' })

  const [program] = await sql.insert<Program[]>('programs', {
    user_id: userId,
    intake_id: intake.id,
    name: plan.block_name,
    block_number: blockNumber,
    weeks: BLOCK_WEEKS,
    starts_on: new Date().toISOString().slice(0, 10),
    status: 'active',
    ai_model: MINIMAX_MODEL,
    ai_rationale: plan.rationale,
  })
  if (!program) throw new HttpError('No pudimos guardar el plan.', 500)

  const expanded = expandBlock(plan)

  const insertedDays = await sql.insert<ProgramDay[]>(
    'program_days',
    expanded.map((d) => ({
      program_id: program.id,
      week: d.week,
      day_index: d.day_index,
      title: d.title,
      focus: d.focus,
      is_deload: d.is_deload,
    })),
  )

  const byKey = new Map(insertedDays.map((d) => [`${d.week}-${d.day_index}`, d.id]))
  const exerciseRows = expanded.flatMap((d) => {
    const dayId = byKey.get(`${d.week}-${d.day_index}`)
    if (!dayId) return []
    return d.exercises.map((e) => ({
      program_day_id: dayId,
      exercise_id: e.exercise_id,
      category: e.category,
      position: e.position,
      target_sets: e.target_sets,
      target_reps: e.target_reps,
      target_duration_seconds: e.target_duration_seconds,
      target_rpe: e.target_rpe,
      rest_seconds: e.rest_seconds,
      progression_scheme: e.progression_scheme,
      coach_note: e.coach_note,
    }))
  })

  await sql.insert('program_exercises', exerciseRows, false)

  return json({
    program_id: program.id,
    name: program.name,
    rationale: program.ai_rationale,
    exercise_ids: [...new Set(exerciseRows.map((e) => e.exercise_id))],
  })
}
