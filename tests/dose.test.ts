import { describe, it, expect } from 'vitest'
import { formatDose, formatRest, planSummary } from '@/lib/dose'
import type { ProgramExercise } from '@/lib/supabase/types'

const ex = (overrides: Partial<ProgramExercise> = {}): ProgramExercise => ({
  id: 'pe1',
  program_day_id: 'pd1',
  exercise_id: 'Leg_Press',
  category: 'strength',
  position: 1,
  target_sets: 3,
  target_reps: '10-12',
  target_weight: null,
  target_duration_seconds: null,
  target_rpe: null,
  rest_seconds: 90,
  progression_scheme: { type: 'double', incrementKg: 2.5 },
  coach_note: null,
  ...overrides,
})

describe('formatRest', () => {
  it('sin descanso no dice nada', () => {
    expect(formatRest(0)).toBeNull()
  })

  it('bajo dos minutos va en segundos', () => {
    expect(formatRest(60)).toBe('60 s')
    expect(formatRest(90)).toBe('90 s')
  })

  it('desde dos minutos va en minutos', () => {
    expect(formatRest(120)).toBe('2 min')
    expect(formatRest(150)).toBe('2:30 min')
  })
})

describe('formatDose', () => {
  it('fuerza: series, reps y descanso', () => {
    expect(formatDose(ex())).toBe('3 × 10-12 · 90 s')
  })

  it('sin reps no deja un × colgando', () => {
    expect(formatDose(ex({ target_reps: null }))).toBe('3 series · 90 s')
  })

  it('reps no numéricas se muestran tal cual', () => {
    expect(formatDose(ex({ target_reps: 'AMRAP' }))).toBe('3 × AMRAP · 90 s')
  })

  it('sin descanso se omite el separador', () => {
    expect(formatDose(ex({ rest_seconds: 0 }))).toBe('3 × 10-12')
  })

  it('cardio va en minutos y sin descanso', () => {
    expect(
      formatDose(ex({ category: 'cardio', target_duration_seconds: 900, rest_seconds: 0 })),
    ).toBe('15 min')
  })
})

describe('planSummary', () => {
  it('toma la moda de series y el rango de reps de la fuerza', () => {
    const s = planSummary(
      [
        ex({ target_sets: 3, target_reps: '8-10' }),
        ex({ target_sets: 3, target_reps: '10-12' }),
        ex({ target_sets: 4, target_reps: '6' }),
      ],
      4,
    )
    expect(s).toEqual({ days: 4, sets: 3, reps: '6-12', cardioMinutes: 0 })
  })

  it('suma los minutos de cardio', () => {
    const s = planSummary(
      [
        ex(),
        ex({ category: 'cardio', target_duration_seconds: 600 }),
        ex({ category: 'cardio', target_duration_seconds: 900 }),
      ],
      3,
    )
    expect(s.cardioMinutes).toBe(25)
  })

  it('sin fuerza no inventa series ni reps', () => {
    const s = planSummary([ex({ category: 'cardio', target_duration_seconds: 600 })], 1)
    expect(s.sets).toBeNull()
    expect(s.reps).toBeNull()
  })

  it('reps sin números no rompen el rango', () => {
    const s = planSummary([ex({ target_reps: 'AMRAP' })], 1)
    expect(s.reps).toBeNull()
  })
})
