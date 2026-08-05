/**
 * El contrato que MiniMax debe cumplir.
 *
 * La IA genera UNA semana más un esquema de progresión por ejercicio; las
 * semanas 2 a 4 se derivan en código con `nextTarget`. Pedirle 4 semanas son
 * ~96 entradas de JSON: caro, lento, y justo donde un modelo se contradice.
 */

export type AiExercise = {
  exercise_id: string
  sets: number
  reps: string | null
  target_rpe: number | null
  rest_seconds: number
  duration_seconds: number | null
  progression:
    | { type: 'double'; increment_kg: number }
    | { type: 'linear'; increment_kg: number }
    | { type: 'time'; increment_seconds: number; max_seconds: number }
    | { type: 'intensity' }
  coach_note: string | null
}

export type AiDay = {
  day_index: number
  title: string
  focus: string[]
  exercises: AiExercise[]
}

export type AiPlan = {
  block_name: string
  rationale: string
  days: AiDay[]
}

export const PLAN_TOOL_NAME = 'entregar_plan'

export const PLAN_TOOL_SCHEMA = {
  type: 'object',
  required: ['block_name', 'rationale', 'days'],
  properties: {
    block_name: { type: 'string', description: 'Nombre corto del bloque, en español.' },
    rationale: {
      type: 'string',
      description: 'Dos o tres frases en español explicando por qué este bloque para esta persona.',
    },
    days: {
      type: 'array',
      minItems: 2,
      maxItems: 7,
      items: {
        type: 'object',
        required: ['day_index', 'title', 'focus', 'exercises'],
        properties: {
          day_index: { type: 'integer', minimum: 1, maximum: 7, description: '1 = lunes.' },
          title: { type: 'string', description: 'Nombre del día en español, p.ej. "Empuje A".' },
          focus: { type: 'array', items: { type: 'string' } },
          exercises: {
            type: 'array',
            minItems: 3,
            maxItems: 8,
            items: {
              type: 'object',
              required: ['exercise_id', 'sets', 'rest_seconds', 'progression'],
              properties: {
                exercise_id: {
                  type: 'string',
                  description: 'OBLIGATORIO: un id exacto de la lista de candidatos.',
                },
                sets: { type: 'integer', minimum: 1, maximum: 8 },
                reps: {
                  type: ['string', 'null'],
                  description:
                    'SOLO repeticiones: rango "8-10" o valor fijo "12". Nunca tiempo. ' +
                    'Para isométricos, planchas o cardio pon reps en null y usa duration_seconds.',
                },
                target_rpe: { type: ['integer', 'null'], minimum: 5, maximum: 10 },
                rest_seconds: { type: 'integer', minimum: 30, maximum: 300 },
                duration_seconds: {
                  type: ['integer', 'null'],
                  description: 'Solo cardio e isométricos.',
                },
                progression: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: { type: 'string', enum: ['double', 'linear', 'time', 'intensity'] },
                    increment_kg: { type: 'number' },
                    increment_seconds: { type: 'integer' },
                    max_seconds: { type: 'integer' },
                  },
                },
                coach_note: {
                  type: ['string', 'null'],
                  description: 'Un consejo técnico breve, en español.',
                },
              },
            },
          },
        },
      },
    },
  },
} as const

export const TRANSLATE_TOOL_NAME = 'entregar_traducciones'

export const TRANSLATE_TOOL_SCHEMA = {
  type: 'object',
  required: ['translations'],
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['exercise_id', 'name', 'instructions'],
        properties: {
          exercise_id: { type: 'string' },
          name: { type: 'string', description: 'Nombre del ejercicio en español de México.' },
          instructions: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const

export const REVIEW_TOOL_NAME = 'entregar_revision'

export const REVIEW_TOOL_SCHEMA = {
  type: 'object',
  required: ['rationale', 'goal', 'days_per_week', 'focus_muscles', 'notes_for_next_block'],
  properties: {
    rationale: { type: 'string', description: 'Qué pasó en el bloque anterior, en español.' },
    goal: { type: 'string', enum: ['fuerza', 'hipertrofia', 'perdida_grasa', 'resistencia', 'general'] },
    days_per_week: { type: 'integer', minimum: 2, maximum: 7 },
    focus_muscles: { type: 'array', items: { type: 'string' } },
    notes_for_next_block: {
      type: 'string',
      description: 'Instrucciones concretas para armar el siguiente bloque.',
    },
  },
} as const
