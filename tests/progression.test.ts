import { describe, it, expect } from 'vitest'
import { nextTarget, deloadTarget, parseRepRange, type Target } from '@/lib/progression'

const scheme = { type: 'double', incrementKg: 2.5 } as const
const base: Target = {
  sets: 4,
  repRange: [8, 10],
  weight: 60,
  durationSeconds: null,
  note: null,
}

const perf = (reps: number[], weight = 60) => ({
  sets: reps.map((r) => ({ reps: r, weight, durationSeconds: null, done: true })),
  failedFloorStreak: 0,
})

describe('parseRepRange', () => {
  it('interpreta un rango', () => expect(parseRepRange('8-10')).toEqual([8, 10]))
  it('interpreta un valor fijo', () => expect(parseRepRange('12')).toEqual([12, 12]))
  it('tolera espacios', () => expect(parseRepRange(' 6 - 8 ')).toEqual([6, 8]))
  it('con basura devuelve null', () => expect(parseRepRange('muchas')).toBeNull())
})

describe('doble progresión', () => {
  it('sin historial deja el peso en null y marca calibración', () => {
    const out = nextTarget(base, scheme, null)
    expect(out.weight).toBeNull()
    expect(out.note).toMatch(/calibra/i)
  })

  it('con todas las series al tope del rango sube peso y mantiene el rango', () => {
    const out = nextTarget(base, scheme, perf([10, 10, 10, 10]))
    expect(out.weight).toBe(62.5)
    expect(out.repRange).toEqual([8, 10])
  })

  it('sin llegar al tope mantiene el peso', () => {
    expect(nextTarget(base, scheme, perf([10, 10, 9, 8])).weight).toBe(60)
  })

  it('fallar el piso una vez mantiene el peso', () => {
    const last = { ...perf([8, 7, 6, 6]), failedFloorStreak: 1 }
    expect(nextTarget(base, scheme, last).weight).toBe(60)
  })

  it('fallar el piso dos veces seguidas aplica deload del 10%', () => {
    const last = { ...perf([7, 6, 6, 5]), failedFloorStreak: 2 }
    expect(nextTarget(base, scheme, last).weight).toBe(54)
  })

  it('las series sin marcar no cuentan como completadas', () => {
    const last = {
      sets: [
        { reps: 10, weight: 60, durationSeconds: null, done: true },
        { reps: 10, weight: 60, durationSeconds: null, done: true },
        { reps: 10, weight: 60, durationSeconds: null, done: true },
        { reps: 10, weight: 60, durationSeconds: null, done: false },
      ],
      failedFloorStreak: 0,
    }
    expect(nextTarget(base, scheme, last).weight).toBe(60)
  })

  it('usa el peso realmente levantado, no el prescrito', () => {
    // El usuario calibró en 50 aunque el objetivo decía 60.
    const out = nextTarget(base, scheme, perf([10, 10, 10, 10], 50))
    expect(out.weight).toBe(52.5)
  })

  it('redondea a múltiplos de 0.5 kg', () => {
    const out = nextTarget({ ...base, weight: 61.3 }, scheme, perf([10, 10, 10, 10], 61.3))
    expect(out.weight! % 0.5).toBe(0)
  })

  it('nunca baja de 20 kg con el deload', () => {
    const last = { ...perf([5, 5, 4, 4], 20), failedFloorStreak: 2 }
    expect(nextTarget({ ...base, weight: 20 }, scheme, last).weight).toBe(20)
  })

  it('con menos series registradas que las prescritas no sube', () => {
    expect(nextTarget(base, scheme, perf([10, 10])).weight).toBe(60)
  })
})

describe('progresión lineal', () => {
  const linear = { type: 'linear', incrementKg: 5 } as const

  it('sube siempre que se completen todas las series', () => {
    expect(nextTarget(base, linear, perf([8, 8, 8, 8])).weight).toBe(65)
  })

  it('no sube si alguna serie quedó sin marcar', () => {
    const last = {
      sets: [
        { reps: 8, weight: 60, durationSeconds: null, done: true },
        { reps: 8, weight: 60, durationSeconds: null, done: false },
      ],
      failedFloorStreak: 0,
    }
    expect(nextTarget({ ...base, sets: 2 }, linear, last).weight).toBe(60)
  })
})

describe('progresión de cardio', () => {
  const cardio: Target = {
    sets: 1,
    repRange: null,
    weight: null,
    durationSeconds: 900,
    note: null,
  }
  const timeScheme = { type: 'time', incrementSeconds: 60, maxSeconds: 1800 } as const

  it('suma tiempo al completarlo', () => {
    const last = {
      sets: [{ reps: null, weight: null, durationSeconds: 900, done: true }],
      failedFloorStreak: 0,
    }
    expect(nextTarget(cardio, timeScheme, last).durationSeconds).toBe(960)
  })

  it('se detiene en el máximo', () => {
    const last = {
      sets: [{ reps: null, weight: null, durationSeconds: 1800, done: true }],
      failedFloorStreak: 0,
    }
    expect(nextTarget({ ...cardio, durationSeconds: 1800 }, timeScheme, last).durationSeconds).toBe(
      1800,
    )
  })

  it('no sube si no se completó', () => {
    const last = {
      sets: [{ reps: null, weight: null, durationSeconds: 400, done: false }],
      failedFloorStreak: 0,
    }
    expect(nextTarget(cardio, timeScheme, last).durationSeconds).toBe(900)
  })

  it('el esquema por intensidad no toca la duración y deja nota', () => {
    const last = {
      sets: [{ reps: null, weight: null, durationSeconds: 900, done: true }],
      failedFloorStreak: 0,
    }
    const out = nextTarget(cardio, { type: 'intensity' }, last)
    expect(out.durationSeconds).toBe(900)
    expect(out.note).toMatch(/nivel/i)
  })
})

describe('deloadTarget', () => {
  it('baja series al 60% y peso al 90%', () => {
    const out = deloadTarget({ ...base, sets: 5, weight: 100 })
    expect(out.sets).toBe(3)
    expect(out.weight).toBe(90)
  })

  it('nunca deja menos de 1 serie', () => {
    expect(deloadTarget({ ...base, sets: 1 }).sets).toBe(1)
  })

  it('con peso nulo lo deja nulo', () => {
    expect(deloadTarget({ ...base, weight: null }).weight).toBeNull()
  })

  it('también recorta la duración del cardio', () => {
    const out = deloadTarget({ ...base, weight: null, durationSeconds: 1200 })
    expect(out.durationSeconds).toBe(720)
  })
})
