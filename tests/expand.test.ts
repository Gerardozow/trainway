import { describe, it, expect } from 'vitest'
import { expandBlock, BLOCK_WEEKS } from '../worker/lib/expand'
import type { AiPlan } from '../worker/lib/schemas'
import { getExercise } from '@/lib/catalog'

// Ids reales del catálogo: uno compuesto, uno de aislamiento, uno de cardio.
const COMPOUND = 'Barbell_Bench_Press_-_Medium_Grip'
const ISOLATION = 'Barbell_Curl'
const CARDIO = 'Rowing_Stationary'

const plan: AiPlan = {
  block_name: 'Bloque 1',
  rationale: 'razón',
  days: [
    {
      day_index: 1,
      title: 'Empuje',
      focus: ['chest'],
      exercises: [
        {
          exercise_id: COMPOUND,
          sets: 4,
          reps: '6-8',
          target_rpe: 8,
          rest_seconds: 150,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: 'nota',
        },
        {
          exercise_id: ISOLATION,
          sets: 3,
          reps: '10-12',
          target_rpe: 9,
          rest_seconds: 60,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: null,
        },
        {
          exercise_id: CARDIO,
          sets: 1,
          reps: null,
          target_rpe: 6,
          rest_seconds: 60,
          duration_seconds: 900,
          progression: { type: 'time', increment_seconds: 60, max_seconds: 1800 },
          coach_note: null,
        },
      ],
    },
    {
      day_index: 4,
      title: 'Tirón',
      focus: ['lats'],
      exercises: [
        {
          exercise_id: COMPOUND,
          sets: 4,
          reps: '8-10',
          target_rpe: 8,
          rest_seconds: 120,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: null,
        },
        {
          exercise_id: ISOLATION,
          sets: 3,
          reps: '12',
          target_rpe: 9,
          rest_seconds: 60,
          duration_seconds: null,
          progression: { type: 'linear', increment_kg: 2.5 },
          coach_note: null,
        },
        {
          exercise_id: CARDIO,
          sets: 1,
          reps: null,
          target_rpe: 6,
          rest_seconds: 60,
          duration_seconds: 600,
          progression: { type: 'intensity' },
          coach_note: null,
        },
      ],
    },
  ],
}

const days = expandBlock(plan)
const week = (n: number) => days.filter((d) => d.week === n)

describe('expandBlock', () => {
  it('genera 4 semanas con los mismos días', () => {
    expect(new Set(days.map((d) => d.week))).toEqual(new Set([1, 2, 3, 4]))
    expect(days).toHaveLength(BLOCK_WEEKS * plan.days.length)
  })

  it('conserva day_index y título de cada día', () => {
    for (const d of days) {
      expect([1, 4]).toContain(d.day_index)
      expect(['Empuje', 'Tirón']).toContain(d.title)
    }
  })

  it('las semanas 1 y 2 llevan la plantilla tal cual', () => {
    expect(week(1)[0]!.exercises[0]!.target_sets).toBe(4)
    expect(week(2)[0]!.exercises[0]!.target_sets).toBe(4)
  })

  it('la semana 3 suma una serie solo a los compuestos', () => {
    const [compound, isolation] = week(3)[0]!.exercises
    expect(compound!.target_sets).toBe(5)
    expect(isolation!.target_sets).toBe(3)
  })

  it('la semana 4 es descarga y recorta el volumen', () => {
    const w4 = week(4)[0]!
    expect(w4.is_deload).toBe(true)
    expect(w4.exercises[0]!.target_sets).toBe(2) // round(4 * 0.6)
  })

  it('ninguna semana salvo la 4 está marcada como descarga', () => {
    for (const d of days) expect(d.is_deload).toBe(d.week === 4)
  })

  it('la descarga también recorta la duración del cardio', () => {
    expect(week(1)[0]!.exercises[2]!.target_duration_seconds).toBe(900)
    expect(week(4)[0]!.exercises[2]!.target_duration_seconds).toBe(540)
  })

  it('nunca deja un ejercicio con menos de 1 serie', () => {
    for (const d of days) for (const e of d.exercises) expect(e.target_sets).toBeGreaterThanOrEqual(1)
  })

  it('toma la categoría real del catálogo, no la que diga la IA', () => {
    const ex = week(1)[0]!.exercises
    expect(ex[0]!.category).toBe(getExercise(COMPOUND)!.category)
    expect(ex[2]!.category).toBe('cardio')
  })

  it('traduce los esquemas de progresión a la forma que usa el cliente', () => {
    const w = week(1)
    expect(w[0]!.exercises[0]!.progression_scheme).toEqual({ type: 'double', incrementKg: 2.5 })
    expect(w[1]!.exercises[1]!.progression_scheme).toEqual({ type: 'linear', incrementKg: 2.5 })
    expect(w[0]!.exercises[2]!.progression_scheme).toEqual({
      type: 'time',
      incrementSeconds: 60,
      maxSeconds: 1800,
    })
    expect(w[1]!.exercises[2]!.progression_scheme).toEqual({ type: 'intensity' })
  })

  it('las posiciones son consecutivas desde 0 dentro de cada día', () => {
    for (const d of days) {
      expect(d.exercises.map((e) => e.position)).toEqual(d.exercises.map((_, i) => i))
    }
  })
})
