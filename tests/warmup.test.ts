import { describe, it, expect } from 'vitest'
import { barFor, warmupSets } from '@/lib/warmup'

describe('barFor', () => {
  it('barra olímpica en kilos', () => expect(barFor('barbell', 'metric')).toBe(20))
  it('barra olímpica en libras', () => expect(barFor('barbell', 'imperial')).toBe(45))
  it('barra Z más ligera', () => expect(barFor('e-z curl bar', 'metric')).toBe(10))
  it('sin barra en mancuernas y máquinas', () => {
    expect(barFor('dumbbell', 'metric')).toBe(0)
    expect(barFor('machine', 'metric')).toBe(0)
    expect(barFor(null, 'metric')).toBe(0)
  })
})

describe('warmupSets', () => {
  it('rampa completa con barra', () => {
    expect(warmupSets(60, { bar: 20 })).toEqual([
      { weight: 20, reps: 10 },
      { weight: 25, reps: 8 },
      { weight: 35, reps: 5 },
      { weight: 47.5, reps: 3 },
    ])
  })

  it('sube y nunca alcanza el peso de trabajo', () => {
    const ramp = warmupSets(100, { bar: 20 })
    for (let i = 1; i < ramp.length; i++) {
      expect(ramp[i]!.weight).toBeGreaterThan(ramp[i - 1]!.weight)
    }
    expect(ramp.at(-1)!.weight).toBeLessThan(100)
  })

  it('sin barra empieza en el primer escalón', () => {
    expect(warmupSets(50)).toEqual([
      { weight: 20, reps: 8 },
      { weight: 30, reps: 5 },
      { weight: 40, reps: 3 },
    ])
  })

  it('descarta los escalones que no llegan a la barra', () => {
    const ramp = warmupSets(40, { bar: 20 })
    expect(ramp.every((s) => s.weight >= 20)).toBe(true)
    expect(ramp.filter((s) => s.weight === 20)).toHaveLength(1)
  })

  it('sin peso de trabajo no hay nada que calentar', () => {
    expect(warmupSets(null, { bar: 20 })).toEqual([])
  })

  it('a la altura de la barra vacía la rampa sobra', () => {
    expect(warmupSets(20, { bar: 20 })).toEqual([])
    expect(warmupSets(22.5, { bar: 20 })).toEqual([])
  })
})
