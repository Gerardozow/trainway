import { json, requireConfig, type Env } from '../lib/auth'
import { callStructured, createMinimax } from '../lib/minimax'
import { REVIEW_SYSTEM_PROMPT } from '../lib/prompt'
import { REVIEW_TOOL_NAME, REVIEW_TOOL_SCHEMA } from '../lib/schemas'
import { muscleEs } from '@/lib/catalog'

export type BlockSummary = {
  adherence_pct: number
  sessions_completed: number
  sessions_planned: number
  volume_by_muscle: Record<string, number>
  avg_rpe: number | null
  progressed: string[]
  stalled: string[]
  user_notes: string[]
}

/**
 * Revisa el bloque que acaba de cerrarse.
 *
 * Recibe un resumen compacto, no el historial crudo: mandarle cientos de series
 * a un modelo cuesta tokens y no mejora la decisión. Lo que importa es la
 * tendencia — adherencia, volumen por grupo, esfuerzo, qué subió y qué no.
 */
export async function handleReview(req: Request, env: Env): Promise<Response> {
  requireConfig(env, ['MINIMAX_API_KEY'])

  const summary = (await req.json().catch(() => ({}))) as Partial<BlockSummary>

  const volume = Object.entries(summary.volume_by_muscle ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([m, series]) => `  ${muscleEs(m)}: ${series} series`)
    .join('\n')

  const notes = (summary.user_notes ?? []).slice(0, 20)

  const client = createMinimax(env.MINIMAX_API_KEY)
  const raw = await callStructured(client, {
    system: REVIEW_SYSTEM_PROMPT,
    user: `RESUMEN DEL BLOQUE QUE TERMINÓ

Adherencia: ${summary.adherence_pct ?? 0}% (${summary.sessions_completed ?? 0} de ${summary.sessions_planned ?? 0} sesiones)
RPE medio: ${summary.avg_rpe ?? 'sin datos'}

Volumen semanal por grupo:
${volume || '  sin datos'}

Ejercicios que progresaron: ${(summary.progressed ?? []).join(', ') || 'ninguno'}
Ejercicios estancados: ${(summary.stalled ?? []).join(', ') || 'ninguno'}

Notas que dejó la persona:
${notes.length ? notes.map((n) => `- """${n.slice(0, 300)}"""`).join('\n') : '- (ninguna)'}

Decide cómo debe ser el siguiente bloque y entrégalo con la herramienta.`,
    toolName: REVIEW_TOOL_NAME,
    toolSchema: REVIEW_TOOL_SCHEMA,
    maxTokens: 2000,
  })

  return json(raw)
}
