import { describe, it, expect } from 'vitest'
import { filterCandidates, getExercise, imageUrl, GYM_CARDIO_IDS, GYM_STAPLE_IDS, ALL_EXERCISES } from '@/lib/catalog'
import { MUSCLE_ES, EQUIPMENT_ES } from '@/lib/catalog/labels.es'

describe('filterCandidates', () => {
  it('solo devuelve ejercicios cuyo equipamiento esté disponible', () => {
    const out = filterCandidates({
      equipment: ['dumbbell'],
      level: 'principiante',
      focusMuscles: ['chest'],
      includeCardio: false,
    })
    expect(out.length).toBeGreaterThan(0)
    for (const e of out) expect(['dumbbell', 'body only']).toContain(e.equipment)
  })

  it('un principiante no recibe ejercicios de nivel experto', () => {
    const out = filterCandidates({
      equipment: ['barbell'],
      level: 'principiante',
      focusMuscles: ['quadriceps'],
      includeCardio: false,
    })
    expect(out.length).toBeGreaterThan(0)
    for (const e of out) expect(e.level).not.toBe('expert')
  })

  it('un avanzado sí recibe ejercicios de todos los niveles', () => {
    const out = filterCandidates({
      equipment: ['barbell'],
      level: 'avanzado',
      focusMuscles: ['quadriceps'],
      includeCardio: false,
      limit: 200,
    })
    expect(out.some((e) => e.level === 'expert')).toBe(true)
  })

  it('con includeCardio solo mete cardio de gimnasio, nunca de exterior', () => {
    const out = filterCandidates({
      equipment: ['machine'],
      level: 'intermedio',
      focusMuscles: [],
      includeCardio: true,
      limit: 200,
    })
    const cardio = out.filter((e) => e.category === 'cardio')
    expect(cardio.length).toBeGreaterThan(0)
    for (const e of cardio) expect(GYM_CARDIO_IDS).toContain(e.id)
    const ids = out.map((e) => e.id)
    expect(ids).not.toContain('Bicycling')
    expect(ids).not.toContain('Skating')
    expect(ids).not.toContain('Trail_Running_Walking')
  })

  /*
   * El fallo que esto guarda: el cardio pasaba el filtro y lo mataba el
   * recorte. Se puntúa por músculos trabajados y una cinta no trabaja el pecho,
   * así que caía al final de una lista de ochocientos y el corte a sesenta se
   * lo llevaba entero. Pedir cardio en el cuestionario no cambiaba nada: el
   * modelo nunca vio una sola máquina que poder elegir.
   *
   * La prueba anterior no lo detectaba porque pedía 200 candidatos. El límite
   * de verdad, el que usa `worker/routes/plan.ts`, es 90.
   */
  const LIMITE_REAL = 90

  it('con el límite de verdad el cardio sigue llegando al modelo', () => {
    const out = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      level: 'intermedio',
      // Un foco que no toca ninguna máquina de cardio: el caso que lo hundía.
      focusMuscles: ['chest', 'lats', 'biceps'],
      includeCardio: true,
      limit: LIMITE_REAL,
    })

    expect(out.filter((e) => e.category === 'cardio').length).toBeGreaterThan(0)
  })

  it('el cardio no se cuela de más ni rompe el límite', () => {
    const out = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      level: 'intermedio',
      focusMuscles: ['chest'],
      includeCardio: true,
      limit: LIMITE_REAL,
    })

    expect(out).toHaveLength(LIMITE_REAL)
    // Reservar sitio para cardio no puede dejar la sesión sin pesas.
    expect(out.filter((e) => e.category === 'cardio').length).toBeLessThanOrEqual(5)
    expect(out.filter((e) => e.category !== 'cardio').length).toBeGreaterThan(50)
  })

  it('sin cardio pedido el límite se llena de pesas', () => {
    const out = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      level: 'intermedio',
      focusMuscles: ['chest'],
      includeCardio: false,
      limit: LIMITE_REAL,
    })

    expect(out).toHaveLength(LIMITE_REAL)
    expect(out.filter((e) => e.category === 'cardio')).toHaveLength(0)
  })

  it('sin includeCardio no aparece ningún cardio', () => {
    const out = filterCandidates({
      equipment: ['machine'],
      level: 'intermedio',
      focusMuscles: [],
      includeCardio: false,
      limit: 200,
    })
    expect(out.filter((e) => e.category === 'cardio')).toHaveLength(0)
  })

  it('nunca devuelve estiramientos ni rodillo de espuma', () => {
    const out = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'foam roll'],
      level: 'avanzado',
      focusMuscles: ['lats'],
      includeCardio: false,
      limit: 200,
    })
    for (const e of out) expect(e.category).not.toBe('stretching')
  })

  it('prioriza compuestos y respeta el límite', () => {
    const out = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      level: 'intermedio',
      focusMuscles: ['chest', 'lats'],
      includeCardio: false,
      limit: 20,
    })
    expect(out).toHaveLength(20)
    expect(out[0]!.mechanic).toBe('compound')
  })

  it('pone primero los que atacan un músculo objetivo como primario', () => {
    const out = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      level: 'intermedio',
      focusMuscles: ['chest'],
      includeCardio: false,
      limit: 10,
    })
    expect(out[0]!.primaryMuscles).toContain('chest')
  })

  it('es determinista: dos llamadas iguales devuelven lo mismo', () => {
    const criteria = {
      equipment: ['barbell', 'cable'],
      level: 'intermedio' as const,
      focusMuscles: ['shoulders'],
      includeCardio: false,
      limit: 15,
    }
    expect(filterCandidates(criteria).map((e) => e.id)).toEqual(
      filterCandidates(criteria).map((e) => e.id),
    )
  })

  /*
   * El fallo que esto guarda: con ochocientos ejercicios empatados en
   * puntuación, el desempate alfabético decidía qué veía el modelo. Sin foco,
   * los sesenta candidatos eran de la A a la C —Anti-Gravity Press, Cable Judo
   * Flip, Clean from Blocks— y faltaban prensa, jalón al pecho o curl femoral.
   */
  it('los básicos de cualquier gimnasio llegan al modelo aunque no haya foco', () => {
    const ids = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      level: 'intermedio',
      focusMuscles: [],
      includeCardio: false,
      limit: LIMITE_REAL,
    }).map((e) => e.id)

    for (const id of [
      'Leg_Press',
      'Wide-Grip_Lat_Pulldown',
      'Seated_Cable_Rows',
      'Lying_Leg_Curls',
      'Triceps_Pushdown',
    ]) {
      expect(ids).toContain(id)
    }
    for (const rareza of ['Anti-Gravity_Press', 'Cable_Judo_Flip', 'Clean_from_Blocks']) {
      expect(ids).not.toContain(rareza)
    }
  })

  it('con foco en un grupo, el resto de grupos sigue teniendo sus básicos', () => {
    const ids = filterCandidates({
      equipment: ['barbell', 'dumbbell', 'cable', 'machine'],
      level: 'intermedio',
      focusMuscles: ['chest', 'glutes'],
      includeCardio: false,
      limit: LIMITE_REAL,
    }).map((e) => e.id)

    // Un día de pierna o de espalda tiene que poder armarse igual.
    expect(ids).toContain('Leg_Press')
    expect(ids).toContain('Wide-Grip_Lat_Pulldown')
  })

  it('todos los básicos existen en el catálogo', () => {
    for (const id of GYM_STAPLE_IDS) expect(getExercise(id), id).toBeDefined()
  })

  it('sin equipamiento cae a peso corporal en vez de devolver vacío', () => {
    const out = filterCandidates({
      equipment: [],
      level: 'principiante',
      focusMuscles: ['chest'],
      includeCardio: false,
    })
    expect(out.length).toBeGreaterThan(0)
    for (const e of out) expect(e.equipment).toBe('body only')
  })
})

describe('getExercise e imageUrl', () => {
  it('encuentra por id', () => {
    expect(getExercise('Barbell_Bench_Press_-_Medium_Grip')?.name).toContain('Bench Press')
  })

  it('devuelve undefined con un id inventado', () => {
    expect(getExercise('Ejercicio_Inventado_Por_La_IA')).toBeUndefined()
  })

  it('construye la url de jsDelivr', () => {
    expect(imageUrl('X/0.jpg')).toBe('https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/X/0.jpg')
  })
})

describe('etiquetas en español', () => {
  it('cubre todos los músculos del catálogo', () => {
    const all = new Set(ALL_EXERCISES.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]))
    for (const m of all) expect(MUSCLE_ES[m], `falta traducción de "${m}"`).toBeTruthy()
  })

  it('cubre todo el equipamiento del catálogo', () => {
    const all = new Set(ALL_EXERCISES.map((e) => e.equipment).filter(Boolean) as string[])
    for (const q of all) expect(EQUIPMENT_ES[q], `falta traducción de "${q}"`).toBeTruthy()
  })
})
