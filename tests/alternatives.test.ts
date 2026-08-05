import { describe, it, expect } from 'vitest'
import { findAlternatives, getExercise, ALL_EXERCISES } from '@/lib/catalog'
import { toBodyMuscles, bestView } from '@/lib/catalog/muscleMap'

const press = getExercise('Barbell_Bench_Press_-_Medium_Grip')!
const sentadilla = getExercise('Barbell_Squat')!
const remoMaquina = getExercise('Rowing_Stationary')!

const alt = (over: Partial<Parameters<typeof findAlternatives>[0]> = {}) =>
  findAlternatives({ current: press, equipment: ['barbell', 'dumbbell', 'machine'], ...over }, ALL_EXERCISES)

describe('findAlternatives', () => {
  it('devuelve opciones que trabajan el mismo músculo primario', () => {
    const out = alt()
    expect(out.length).toBeGreaterThan(0)
    for (const e of out) {
      expect(e.primaryMuscles.some((m) => press.primaryMuscles.includes(m))).toBe(true)
    }
  })

  it('nunca devuelve el ejercicio que se quiere cambiar', () => {
    expect(alt().map((e) => e.id)).not.toContain(press.id)
  })

  it('excluye los que ya están en la sesión de hoy', () => {
    const primero = alt()[0]!
    const out = alt({ excludeIds: [primero.id] })
    expect(out.map((e) => e.id)).not.toContain(primero.id)
  })

  it('respeta el equipamiento disponible', () => {
    const out = alt({ equipment: ['dumbbell'] })
    expect(out.length).toBeGreaterThan(0)
    for (const e of out) expect(['dumbbell', 'body only']).toContain(e.equipment)
  })

  it('sin equipamiento declarado no filtra por equipamiento', () => {
    const out = alt({ equipment: [] })
    expect(new Set(out.map((e) => e.equipment)).size).toBeGreaterThan(1)
  })

  it('prefiere la misma mecánica: un compuesto se sustituye por un compuesto', () => {
    expect(press.mechanic).toBe('compound')
    expect(alt()[0]!.mechanic).toBe('compound')
  })

  it('para una sentadilla propone otro compuesto de pierna', () => {
    const out = findAlternatives(
      { current: sentadilla, equipment: ['barbell', 'dumbbell', 'machine'] },
      ALL_EXERCISES,
    )
    expect(out[0]!.mechanic).toBe('compound')
    expect(out[0]!.primaryMuscles).toContain('quadriceps')
  })

  it('solo ofrece cardio como alternativa a cardio', () => {
    const out = findAlternatives(
      { current: remoMaquina, equipment: ['machine'] },
      ALL_EXERCISES,
    )
    for (const e of out) expect(e.category).toBe('cardio')
  })

  it('no ofrece cardio como alternativa a un ejercicio de fuerza', () => {
    for (const e of alt()) expect(e.category).not.toBe('cardio')
  })

  it('nunca ofrece estiramientos', () => {
    for (const e of alt({ equipment: [] })) expect(e.category).not.toBe('stretching')
  })

  it('respeta el límite y es determinista', () => {
    expect(alt({ limit: 5 })).toHaveLength(5)
    expect(alt().map((e) => e.id)).toEqual(alt().map((e) => e.id))
  })

  it('con un equipamiento imposible devuelve al menos peso corporal', () => {
    const out = alt({ equipment: ['bands'] })
    for (const e of out) expect(['bands', 'body only']).toContain(e.equipment)
  })
})

describe('mapa muscular', () => {
  it('traduce los músculos del catálogo a los del dibujo', () => {
    expect(toBodyMuscles(['chest'])).toEqual(['chest'])
    expect(toBodyMuscles(['lats'])).toEqual(['upper-back'])
    expect(toBodyMuscles(['shoulders'])).toEqual(['front-deltoids', 'back-deltoids'])
  })

  it('no repite cuando dos músculos del catálogo caen en el mismo del dibujo', () => {
    expect(toBodyMuscles(['lats', 'middle back'])).toEqual(['upper-back'])
  })

  it('cubre los 17 músculos del catálogo', () => {
    const todos = new Set(ALL_EXERCISES.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]))
    for (const m of todos) {
      expect(toBodyMuscles([m]).length, `"${m}" no tiene equivalente en el dibujo`).toBeGreaterThan(0)
    }
  })

  it('elige la vista que mejor enseña el músculo', () => {
    expect(bestView(['chest'])).toBe('anterior')
    expect(bestView(['quadriceps'])).toBe('anterior')
    expect(bestView(['lats', 'middle back'])).toBe('posterior')
    expect(bestView(['hamstrings', 'glutes'])).toBe('posterior')
  })

  it('con una lista vacía no falla', () => {
    expect(toBodyMuscles([])).toEqual([])
    expect(['anterior', 'posterior']).toContain(bestView([]))
  })
})
