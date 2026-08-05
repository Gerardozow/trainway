// @vitest-environment node
//
// En jsdom el SDK de Anthropic se niega a arrancar, y hace bien: cree que está
// en un navegador y que la key quedaría expuesta. La respuesta correcta es
// correr esto en node, no desactivar esa protección.
import { describe, it, expect } from 'vitest'
import Anthropic from '@anthropic-ai/sdk'
import { filterCandidates } from '@/lib/catalog'
import { buildPlanPrompt, PLAN_SYSTEM_PROMPT } from '../worker/lib/prompt'
import { PLAN_TOOL_NAME, PLAN_TOOL_SCHEMA } from '../worker/lib/schemas'
import { normalizePlan, validatePlan } from '../worker/lib/validate'
import { expandBlock } from '../worker/lib/expand'
import type { Intake } from '@/lib/supabase/types'

/**
 * La única prueba que toca la API de verdad.
 *
 * Todo lo demás está cubierto con respuestas sintéticas, pero eso solo
 * demuestra que el validador funciona — no que el modelo produzca planes
 * válidos. Esto lo comprueba de punta a punta y cuesta una llamada.
 *
 * Se salta sin MINIMAX_API_KEY para no gastar créditos en cada `npm test`.
 */
const KEY = process.env.MINIMAX_API_KEY
const suite = KEY ? describe : describe.skip

const intake: Intake = {
  id: 'i1',
  user_id: 'u1',
  goal: 'hipertrofia',
  days_per_week: 4,
  session_minutes: 60,
  experience: 'intermedio',
  equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
  focus_muscles: ['chest', 'lats', 'quadriceps'],
  include_cardio: true,
  limitations: 'Me molesta el hombro derecho en press militar.',
  free_notes: 'Los martes solo tengo 40 minutos.',
  created_at: '2026-08-05T00:00:00Z',
}

suite('MiniMax genera planes que pasan la validación', () => {
  it(
    'devuelve un mesociclo válido con ejercicios reales del catálogo',
    async () => {
      const candidates = filterCandidates({
        equipment: intake.equipment,
        level: intake.experience,
        focusMuscles: intake.focus_muscles,
        includeCardio: intake.include_cardio,
        limit: 60,
      })
      const candidateIds = candidates.map((c) => c.id)

      const client = new Anthropic({
        apiKey: KEY!,
        baseURL: 'https://api.minimax.io/anthropic',
        maxRetries: 1,
        timeout: 180_000,
      })

      const response = await client.messages.create({
        model: 'MiniMax-M3',
        max_tokens: 8000,
        system: PLAN_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: buildPlanPrompt({ intake, candidates, blockNumber: 1, previousReview: null }),
          },
        ],
        tools: [
          {
            name: PLAN_TOOL_NAME,
            description: 'Entrega el resultado en este formato exacto.',
            input_schema: PLAN_TOOL_SCHEMA as never,
          },
        ],
        tool_choice: { type: 'tool', name: PLAN_TOOL_NAME },
      })

      const block = response.content.find((c) => c.type === 'tool_use')
      expect(block, 'MiniMax respondió sin usar la herramienta').toBeDefined()

      const result = validatePlan(
        normalizePlan(block?.type === 'tool_use' ? block.input : null),
        candidateIds,
      )

      if (!result.ok) {
        console.error('Errores de validación:\n' + result.errors.map((e) => `  - ${e}`).join('\n'))
      }
      expect(result.ok, 'el plan no pasó la validación').toBe(true)
      if (!result.ok) return

      const plan = result.plan

      // Respeta los días pedidos.
      expect(plan.days.length).toBe(intake.days_per_week)

      // Y todo id existe de verdad.
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(candidateIds, `${ex.exercise_id} no está entre los candidatos`).toContain(
            ex.exercise_id,
          )
        }
      }

      // La expansión a 4 semanas produce un bloque coherente.
      const expanded = expandBlock(plan)
      expect(expanded.length).toBe(4 * plan.days.length)
      expect(expanded.filter((d) => d.is_deload).length).toBe(plan.days.length)

      console.log(
        `\nBloque: ${plan.block_name}\n${plan.rationale}\n` +
          plan.days
            .map(
              (d) =>
                `  Día ${d.day_index} · ${d.title}\n` +
                d.exercises
                  .map((e) => `    ${e.sets}×${e.reps ?? `${e.duration_seconds}s`}  ${e.exercise_id}`)
                  .join('\n'),
            )
            .join('\n'),
      )
    },
    240_000,
  )
})
