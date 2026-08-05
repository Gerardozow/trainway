import { describe, it, expect } from 'vitest'
import { validatePlan, repairPlan } from '../worker/lib/validate'
import { filterCandidates } from '@/lib/catalog'
import type { AiPlan } from '../worker/lib/schemas'

const candidates = filterCandidates({
  equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
  level: 'intermedio',
  focusMuscles: ['chest', 'lats', 'quadriceps'],
  includeCardio: false,
  limit: 40,
})
const ids = candidates.map((c) => c.id)

const goodPlan = (): AiPlan => ({
  block_name: 'Fuerza base — Bloque 1',
  rationale: 'Cuatro días con frecuencia 2 por grupo.',
  days: [
    {
      day_index: 1,
      title: 'Empuje A',
      focus: ['chest'],
      exercises: [
        {
          exercise_id: ids[0]!,
          sets: 4,
          reps: '6-8',
          target_rpe: 8,
          rest_seconds: 150,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: 'Escápulas retraídas.',
        },
        {
          exercise_id: ids[1]!,
          sets: 3,
          reps: '10-12',
          target_rpe: 8,
          rest_seconds: 90,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: null,
        },
        {
          exercise_id: ids[2]!,
          sets: 3,
          reps: '12',
          target_rpe: 9,
          rest_seconds: 60,
          duration_seconds: null,
          progression: { type: 'linear', increment_kg: 2.5 },
          coach_note: null,
        },
      ],
    },
    {
      day_index: 3,
      title: 'Tirón A',
      focus: ['lats'],
      exercises: [
        {
          exercise_id: ids[3]!,
          sets: 4,
          reps: '8-10',
          target_rpe: 8,
          rest_seconds: 120,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: null,
        },
        {
          exercise_id: ids[4]!,
          sets: 3,
          reps: '10-12',
          target_rpe: 8,
          rest_seconds: 90,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: null,
        },
        {
          exercise_id: ids[5]!,
          sets: 3,
          reps: '12-15',
          target_rpe: 9,
          rest_seconds: 60,
          duration_seconds: null,
          progression: { type: 'double', increment_kg: 2.5 },
          coach_note: null,
        },
      ],
    },
  ],
})

describe('validatePlan', () => {
  it('acepta un plan correcto', () => {
    expect(validatePlan(goodPlan(), ids).ok).toBe(true)
  })

  it('rechaza un exercise_id que no está entre los candidatos', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises[0]!.exercise_id = 'Ejercicio_Inventado_Por_La_IA'
    const out = validatePlan(bad, ids)
    expect(out.ok).toBe(false)
    expect(out.ok === false && out.errors.join(' ')).toContain('Ejercicio_Inventado_Por_La_IA')
  })

  it('rechaza un plan sin días', () => {
    expect(validatePlan({ ...goodPlan(), days: [] }, ids).ok).toBe(false)
  })

  it('rechaza sets fuera de rango', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises[0]!.sets = 0
    expect(validatePlan(bad, ids).ok).toBe(false)
  })

  it('rechaza un rango de reps malformado', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises[0]!.reps = 'muchas'
    expect(validatePlan(bad, ids).ok).toBe(false)
  })

  it('rechaza dos días con el mismo day_index', () => {
    const bad = goodPlan()
    bad.days[1]!.day_index = 1
    expect(validatePlan(bad, ids).ok).toBe(false)
  })

  it('rechaza un esquema de progresión desconocido', () => {
    const bad = goodPlan()
    // @ts-expect-error probamos justo lo que TypeScript impide
    bad.days[0]!.exercises[0]!.progression = { type: 'magia' }
    expect(validatePlan(bad, ids).ok).toBe(false)
  })

  it('rechaza un día con menos de 3 ejercicios', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises = [bad.days[0]!.exercises[0]!]
    expect(validatePlan(bad, ids).ok).toBe(false)
  })

  it('rechaza JSON basura sin lanzar excepción', () => {
    expect(validatePlan(null, ids).ok).toBe(false)
    expect(validatePlan('texto', ids).ok).toBe(false)
    expect(validatePlan(42, ids).ok).toBe(false)
    expect(validatePlan({ days: 'no es un array' }, ids).ok).toBe(false)
    expect(validatePlan({ block_name: 'x', rationale: 'y', days: [null] }, ids).ok).toBe(false)
  })

  it('acumula todos los errores, no solo el primero', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises[0]!.exercise_id = 'Inventado_A'
    bad.days[1]!.exercises[0]!.exercise_id = 'Inventado_B'
    const out = validatePlan(bad, ids)
    expect(out.ok).toBe(false)
    expect(out.ok === false && out.errors.length).toBeGreaterThanOrEqual(2)
  })
})

describe('repairPlan', () => {
  it('sustituye un id inválido por un candidato real', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises[0]!.exercise_id = 'Inventado'
    const fixed = repairPlan(bad, candidates)
    expect(ids).toContain(fixed.days[0]!.exercises[0]!.exercise_id)
  })

  it('elige un sustituto del mismo músculo primario cuando puede', () => {
    const target = candidates.find((c) => c.primaryMuscles.includes('chest'))!
    const bad = goodPlan()
    bad.days[0]!.focus = target.primaryMuscles
    bad.days[0]!.exercises[0]!.exercise_id = 'Inventado'
    const fixed = repairPlan(bad, candidates)
    const chosen = candidates.find((c) => c.id === fixed.days[0]!.exercises[0]!.exercise_id)!
    expect(chosen.primaryMuscles.some((m) => target.primaryMuscles.includes(m))).toBe(true)
  })

  it('no repite un ejercicio que ya está en el mismo día', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises[0]!.exercise_id = 'Inventado'
    const fixed = repairPlan(bad, candidates)
    const dayIds = fixed.days[0]!.exercises.map((e) => e.exercise_id)
    expect(new Set(dayIds).size).toBe(dayIds.length)
  })

  it('no toca los ids que ya son válidos', () => {
    const fixed = repairPlan(goodPlan(), candidates)
    expect(fixed.days[0]!.exercises[0]!.exercise_id).toBe(ids[0])
  })

  it('el plan reparado pasa la validación', () => {
    const bad = goodPlan()
    bad.days[0]!.exercises[0]!.exercise_id = 'Inventado_A'
    bad.days[1]!.exercises[2]!.exercise_id = 'Inventado_B'
    expect(validatePlan(repairPlan(bad, candidates), ids).ok).toBe(true)
  })
})
