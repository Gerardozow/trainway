import { supabase } from '@/lib/supabase/client'
import type { BlockSummary } from './blockSummary'

/**
 * Cliente de los endpoints del Worker.
 *
 * Solo hay tres, y los tres existen por la misma razón: la key de MiniMax no
 * puede estar en el navegador. Todo lo demás va directo a Supabase.
 */
const BASE = '/trainway/api'

async function post<T>(route: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Tu sesión caducó. Vuelve a entrar.')

  const res = await fetch(`${BASE}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

  const payload = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(payload.error ?? 'El servidor no respondió como esperábamos.')
  return payload as T
}

export type GeneratedPlan = {
  program_id: string
  name: string
  rationale: string
  exercise_ids: string[]
}

export function generatePlan(intakeId: string, previousReview?: string): Promise<GeneratedPlan> {
  return post<GeneratedPlan>('plan', { intake_id: intakeId, previous_review: previousReview })
}

/** Falla en silencio: sin traducción la app sigue, solo en inglés. */
export async function translateExercises(exerciseIds: string[]): Promise<void> {
  try {
    await post('translate', { exercise_ids: exerciseIds, locale: 'es' })
  } catch {
    // Degradación limpia.
  }
}

export type BlockReview = {
  rationale: string
  goal: string
  days_per_week: number
  focus_muscles: string[]
  notes_for_next_block: string
}

export function reviewBlock(summary: BlockSummary): Promise<BlockReview> {
  return post<BlockReview>('review', summary)
}
