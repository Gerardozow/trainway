import { describe, it, expect } from 'vitest'
import { lastPerformance } from './lastPerformance'
import type { WorkoutSet } from './workout-types'

function set(
  workoutId: string,
  exerciseId: string,
  completedAt: string,
  reps: number,
  weight: number,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet {
  return {
    id: `${workoutId}-${exerciseId}-${completedAt}-${reps}`,
    workoutId,
    exerciseId,
    setIndex: 0,
    reps,
    weight,
    rpe: null,
    isWarmup: false,
    completedAt,
    ...extra,
  }
}

describe('lastPerformance', () => {
  it('devuelve null cuando no hay historial', () => {
    expect(lastPerformance([], 'squat')).toBeNull()
  })

  it('devuelve null cuando el ejercicio nunca se hizo', () => {
    expect(lastPerformance([set('w1', 'bench', '2026-08-01T10:00:00Z', 8, 60)], 'squat')).toBeNull()
  })

  it('devuelve las series del entreno más reciente con ese ejercicio', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
      set('w1', 'squat', '2026-08-01T10:05:00Z', 8, 60),
      set('w2', 'squat', '2026-08-03T10:00:00Z', 6, 70),
      set('w2', 'squat', '2026-08-03T10:05:00Z', 6, 72.5),
    ]

    expect(lastPerformance(history, 'squat')?.map((e) => e.weight)).toEqual([70, 72.5])
  })

  it('no mezcla ejercicios distintos', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
      set('w2', 'bench', '2026-08-03T10:00:00Z', 10, 40),
    ]

    const last = lastPerformance(history, 'squat')

    expect(last).toHaveLength(1)
    expect(last?.[0].weight).toBe(60)
  })

  it('ordena las series del entreno por hora', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:10:00Z', 6, 65),
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
    ]

    expect(lastPerformance(history, 'squat')?.map((e) => e.weight)).toEqual([60, 65])
  })

  it('ignora las series de calentamiento', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 10, 20, { isWarmup: true }),
      set('w1', 'squat', '2026-08-01T10:05:00Z', 8, 60),
    ]

    const last = lastPerformance(history, 'squat')

    expect(last).toHaveLength(1)
    expect(last?.[0].weight).toBe(60)
  })

  it('devuelve null si el ejercicio solo tiene calentamientos', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 10, 20, { isWarmup: true }),
    ]

    expect(lastPerformance(history, 'squat')).toBeNull()
  })

  it('excluye el entreno en curso cuando se le indica', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
      set('w2', 'squat', '2026-08-03T10:00:00Z', 6, 70),
    ]

    // Comparar contra lo que acabas de levantar hace un minuto no dice nada.
    expect(lastPerformance(history, 'squat', 'w2')?.[0].weight).toBe(60)
  })

  it('devuelve null si el único historial es el entreno en curso', () => {
    const history = [set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60)]
    expect(lastPerformance(history, 'squat', 'w1')).toBeNull()
  })

  it('no confunde entrenos distintos que empiezan el mismo día', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T08:00:00Z', 8, 60),
      set('w2', 'squat', '2026-08-01T18:00:00Z', 5, 80),
    ]

    const last = lastPerformance(history, 'squat')

    expect(last).toHaveLength(1)
    expect(last?.[0].weight).toBe(80)
  })

  it('no muta el historial que recibe', () => {
    const history = [
      set('w1', 'squat', '2026-08-01T10:10:00Z', 6, 65),
      set('w1', 'squat', '2026-08-01T10:00:00Z', 8, 60),
    ]
    const copy = [...history]

    lastPerformance(history, 'squat')

    expect(history).toEqual(copy)
  })
})
