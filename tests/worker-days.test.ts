import { describe, it, expect } from 'vitest'
import { filterCandidates } from '@/lib/catalog'
import { normalizeDays, repairDays, validatePlan } from '../worker/lib/validate'
import { dayRule } from '../worker/lib/prompt'
import type { AiPlan } from '../worker/lib/schemas'

const candidates = filterCandidates({
  equipment: ['barbell', 'dumbbell'],
  level: 'intermedio',
  focusMuscles: ['chest'],
  includeCardio: false,
})
const ids = candidates.map((c) => c.id)

const exercise = (id: string) => ({
  exercise_id: id,
  sets: 3,
  reps: '8-10',
  target_rpe: 8,
  rest_seconds: 90,
  duration_seconds: null,
  progression: { type: 'double', increment_kg: 2.5 },
  coach_note: null,
})

// Tres ejercicios del mismo músculo: el validador pide entre 3 y 8 por día y
// que todos trabajen el foco del día.
const chest = candidates.filter((c) => c.primaryMuscles.includes('chest')).slice(0, 3)

const plan = (dayIndexes: number[]): AiPlan =>
  ({
    block_name: 'Bloque',
    rationale: 'Porque sí',
    days: dayIndexes.map((d) => ({
      day_index: d,
      title: `Día ${d}`,
      focus: ['chest'],
      exercises: chest.map((c) => exercise(c.id)),
    })),
  }) as unknown as AiPlan

describe('normalizeDays', () => {
  it('ordena y quita repetidos', () => {
    expect(normalizeDays([5, 1, 3, 3], 3)).toEqual([1, 3, 5])
  })

  it('descarta lo que no es un día de 1 a 7', () => {
    expect(normalizeDays([0, 9, 'x', 3, 1.5, 5, 1], 3)).toEqual([1, 3, 5])
  })

  it('con menos días que los pedidos se ignora', () => {
    expect(normalizeDays([1, 3], 4)).toBeNull()
  })

  it('sin días no hay nada', () => {
    expect(normalizeDays(undefined, 3)).toBeNull()
  })
})

describe('validatePlan con días permitidos', () => {
  it('acepta un plan dentro de los días elegidos', () => {
    expect(validatePlan(plan([1, 3, 5]), ids, [1, 3, 5]).ok).toBe(true)
  })

  it('rechaza un día que la persona no eligió y dice cuál', () => {
    const out = validatePlan(plan([1, 2, 5]), ids, [1, 3, 5])
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.errors.join(' ')).toMatch(/day_index 2/)
  })

  it('sin días permitidos se comporta como antes', () => {
    expect(validatePlan(plan([1, 2, 5]), ids).ok).toBe(true)
  })
})

describe('repairDays', () => {
  it('reasigna por orden: el primero al primero elegido', () => {
    const out = repairDays(plan([2, 4, 6]), [1, 3, 5])
    expect(out.days.map((d) => d.day_index)).toEqual([1, 3, 5])
    expect(out.days.map((d) => d.title)).toEqual(['Día 2', 'Día 4', 'Día 6'])
  })

  // Con más entrenamientos que días elegidos, los que sobran no tienen a dónde
  // ir: se quedaban en su día, la validación fallaba y la persona se comía un 502.
  it('si la IA devuelve más días que los elegidos, recorta los que sobran', () => {
    const out = repairDays(plan([1, 2, 4, 6]), [1, 3, 5])
    expect(out.days.map((d) => d.day_index)).toEqual([1, 3, 5])
    expect(validatePlan(out, ids, [1, 3, 5]).ok).toBe(true)
  })

  it('si ya está dentro no toca nada', () => {
    const p = plan([1, 3, 5])
    expect(repairDays(p, [1, 3, 5, 6])).toBe(p)
  })

  // La revisión del bloque puede bajar de 4 a 3 días con 4 permitidos.
  it('con más días permitidos que entrenamientos usa los primeros', () => {
    const out = repairDays(plan([2, 4, 7]), [1, 3, 5, 6])
    expect(out.days.map((d) => d.day_index)).toEqual([1, 3, 5])
  })
})

describe('dayRule', () => {
  it('con días exactos los impone', () => {
    expect(dayRule([1, 3, 5, 6], 4)).toMatch(/exactamente estos day_index: 1, 3, 5, 6/)
  })

  it('con días de sobra pide elegir', () => {
    expect(dayRule([1, 3, 5, 6], 3)).toMatch(/3 de estos day_index: 1, 3, 5, 6/)
  })

  it('sin días deja repartir como antes', () => {
    expect(dayRule(null, 4)).toMatch(/Asigna day_index repartiendo/)
  })
})

describe('mondayISO', () => {
  it('un bloque creado un miércoles empieza el lunes de esa semana', async () => {
    const { mondayISO } = await import('../worker/routes/plan')
    expect(mondayISO(new Date('2026-09-23T15:00:00Z'))).toBe('2026-09-21')
    expect(mondayISO(new Date('2026-09-27T15:00:00Z'))).toBe('2026-09-21')
    expect(mondayISO(new Date('2026-09-21T00:30:00Z'))).toBe('2026-09-21')
  })
})

describe('resolveStartsOn', () => {
  const now = new Date('2026-09-28T01:30:00Z') // domingo 27, 19:30 en Ciudad de México

  // En UTC ya es lunes 28: el bloque empezaba la semana siguiente y el domingo
  // ofrecía "Recuperar el lunes" de un lunes que aún no llegaba.
  it('usa el lunes local que manda el cliente', async () => {
    const { resolveStartsOn } = await import('../worker/routes/plan')
    expect(resolveStartsOn('2026-09-21', now)).toBe('2026-09-21')
  })

  it('sin fecha del cliente cae al lunes en UTC', async () => {
    const { resolveStartsOn } = await import('../worker/routes/plan')
    expect(resolveStartsOn(undefined, now)).toBe('2026-09-28')
  })

  it('ignora una fecha que no es un lunes cercano', async () => {
    const { resolveStartsOn } = await import('../worker/routes/plan')
    expect(resolveStartsOn('2026-09-23', now)).toBe('2026-09-28') // miércoles
    expect(resolveStartsOn('2025-01-06', now)).toBe('2026-09-28') // lunes lejano
    expect(resolveStartsOn('x', now)).toBe('2026-09-28')
  })
})
