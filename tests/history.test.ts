import { describe, it, expect } from 'vitest'
import {
  daysBetween,
  estimate1rm,
  groupDoneByDay,
  personalRecords,
  previousSession,
  sessionStreak,
} from '@/lib/history'
import type { ProgramDay, SetLog, WorkoutSession } from '@/lib/supabase/types'

let seq = 0
const log = (partial: Partial<SetLog> & { logged_at: string }): SetLog => ({
  id: `l${seq++}`,
  session_id: 's1',
  program_exercise_id: 'pe1',
  set_index: 0,
  done: true,
  weight: 60,
  reps: 8,
  duration_seconds: null,
  distance_m: null,
  intensity: null,
  rpe: null,
  note: null,
  client_id: `c${seq}`,
  ...partial,
})

describe('daysBetween', () => {
  it('cuenta días completos', () => expect(daysBetween('2026-08-01', '2026-08-08')).toBe(7))
  it('cruza el cambio de mes', () => expect(daysBetween('2026-07-31', '2026-08-01')).toBe(1))
  it('mismo día es cero', () => expect(daysBetween('2026-08-10', '2026-08-10')).toBe(0))
})

describe('groupDoneByDay', () => {
  it('ignora las series sin marcar', () => {
    const grouped = groupDoneByDay([
      log({ logged_at: '2026-08-05T10:00:00Z', done: false }),
      log({ logged_at: '2026-08-05T10:05:00Z' }),
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0]![1]).toHaveLength(1)
  })

  it('ordena los días del más reciente al más antiguo', () => {
    const grouped = groupDoneByDay([
      log({ logged_at: '2026-08-01T10:00:00Z' }),
      log({ logged_at: '2026-08-08T10:00:00Z' }),
    ])
    expect(grouped.map(([d]) => d)).toEqual(['2026-08-08', '2026-08-01'])
  })

  it('ordena las series de cada día por índice', () => {
    const grouped = groupDoneByDay([
      log({ logged_at: '2026-08-08T10:10:00Z', set_index: 2 }),
      log({ logged_at: '2026-08-08T10:00:00Z', set_index: 0 }),
      log({ logged_at: '2026-08-08T10:05:00Z', set_index: 1 }),
    ])
    expect(grouped[0]![1].map((l) => l.set_index)).toEqual([0, 1, 2])
  })

  it('sin historial devuelve lista vacía', () => expect(groupDoneByDay(undefined)).toEqual([]))

  it('agrupa por el día del usuario, no por el de UTC', () => {
    // Las pruebas corren en America/Mexico_City (UTC-6). Un entrenamiento del
    // martes a las 19:00 y otro a las 20:30 se guardan como miércoles 01:00 y
    // 02:30 UTC: cortando la cadena serían dos días distintos, y encima el
    // equivocado.
    const grouped = groupDoneByDay([
      log({ logged_at: '2026-08-05T01:00:00Z', set_index: 0 }),
      log({ logged_at: '2026-08-05T02:30:00Z', set_index: 1 }),
    ])

    expect(grouped).toHaveLength(1)
    expect(grouped[0]![0]).toBe('2026-08-04')
  })
})

describe('previousSession', () => {
  it('devuelve la sesión anterior con sus series en orden', () => {
    const prev = previousSession(
      [
        log({ logged_at: '2026-08-03T10:00:00Z', set_index: 0, weight: 60, reps: 8 }),
        log({ logged_at: '2026-08-03T10:05:00Z', set_index: 1, weight: 60, reps: 7 }),
      ],
      '2026-08-10',
    )
    expect(prev?.date).toBe('2026-08-03')
    expect(prev?.daysAgo).toBe(7)
    expect(prev?.sets.map((s) => s.reps)).toEqual([8, 7])
  })

  it('NO cuenta lo registrado hoy', () => {
    const prev = previousSession(
      [
        log({ logged_at: '2026-08-10T09:00:00Z', weight: 70 }),
        log({ logged_at: '2026-08-03T10:00:00Z', weight: 60 }),
      ],
      '2026-08-10',
    )
    expect(prev?.date).toBe('2026-08-03')
    expect(prev?.sets[0]!.weight).toBe(60)
  })

  it('encuentra la sesión de anoche aunque en UTC sea de hoy', () => {
    // 20:00 del día 9 en México son las 02:00 UTC del día 10: leído en UTC,
    // "la vez pasada" era hoy y no se enseñaba nada.
    const prev = previousSession([log({ logged_at: '2026-08-10T02:00:00Z' })], '2026-08-10')
    expect(prev?.date).toBe('2026-08-09')
    expect(prev?.daysAgo).toBe(1)
  })

  it('sin nada previo devuelve null', () => {
    expect(previousSession([log({ logged_at: '2026-08-10T09:00:00Z' })], '2026-08-10')).toBeNull()
    expect(previousSession(undefined, '2026-08-10')).toBeNull()
  })
})

describe('estimate1rm', () => {
  it('una repetición es el propio peso', () => expect(estimate1rm(100, 1)).toBe(103.5))
  it('crece con las repeticiones', () => expect(estimate1rm(60, 10)).toBe(80))
  it('se corta en 12 repeticiones', () => expect(estimate1rm(60, 30)).toBe(estimate1rm(60, 12)))
})

describe('personalRecords', () => {
  it('elige la mejor serie de cada ejercicio', () => {
    const records = personalRecords({
      press: [
        log({ logged_at: '2026-08-01T10:00:00Z', weight: 60, reps: 8 }),
        log({ logged_at: '2026-08-08T10:00:00Z', weight: 70, reps: 6 }),
      ],
    })
    expect(records).toHaveLength(1)
    expect(records[0]!.weight).toBe(70)
    expect(records[0]!.date).toBe('2026-08-08')
  })

  it('a igualdad de 1RM estimada gana la serie más pesada', () => {
    // 60×10 y 75×2 estiman 80 los dos.
    const records = personalRecords({
      sentadilla: [
        log({ logged_at: '2026-08-01T10:00:00Z', weight: 60, reps: 10 }),
        log({ logged_at: '2026-08-08T10:00:00Z', weight: 75, reps: 2 }),
      ],
    })
    expect(records[0]!.estimated1rm).toBe(80)
    expect(records[0]!.weight).toBe(75)
  })

  it('ignora series sin marcar, sin peso o de peso cero', () => {
    expect(
      personalRecords({
        x: [
          log({ logged_at: '2026-08-01T10:00:00Z', done: false }),
          log({ logged_at: '2026-08-02T10:00:00Z', weight: null }),
          log({ logged_at: '2026-08-03T10:00:00Z', weight: 0 }),
        ],
      }),
    ).toEqual([])
  })

  it('ordena de mayor a menor 1RM estimada', () => {
    const records = personalRecords({
      ligero: [log({ logged_at: '2026-08-01T10:00:00Z', weight: 40, reps: 8 })],
      pesado: [log({ logged_at: '2026-08-01T10:00:00Z', weight: 120, reps: 5 })],
    })
    expect(records.map((r) => r.exerciseId)).toEqual(['pesado', 'ligero'])
  })
})

describe('sessionStreak', () => {
  const day = (id: string, week: number, dayIndex: number): ProgramDay => ({
    id,
    program_id: 'p1',
    week,
    day_index: dayIndex,
    title: 'Día',
    focus: [],
    is_deload: false,
  })

  const session = (programDayId: string, done: boolean): WorkoutSession => ({
    id: `s-${programDayId}`,
    user_id: 'u1',
    program_day_id: programDayId,
    performed_on: '2026-08-01',
    started_at: '2026-08-01T10:00:00Z',
    completed_at: done ? '2026-08-01T11:00:00Z' : null,
    session_rpe: null,
    notes: null,
  })

  const days = [day('a', 1, 1), day('b', 1, 3), day('c', 1, 5), day('d', 2, 1)]

  it('cuenta los días cumplidos hacia atrás', () => {
    expect(
      sessionStreak({
        days,
        sessions: [session('a', true), session('b', true), session('c', true)],
        week: 1,
        dayIndex: 5,
      }),
    ).toBe(3)
  })

  it('se corta en el primer día saltado', () => {
    expect(
      sessionStreak({
        days,
        sessions: [session('a', true), session('c', true)],
        week: 1,
        dayIndex: 5,
      }),
    ).toBe(1)
  })

  it('el día de hoy sin terminar no rompe la racha', () => {
    expect(
      sessionStreak({
        days,
        sessions: [session('a', true), session('b', true)],
        week: 1,
        dayIndex: 5,
      }),
    ).toBe(2)
  })

  it('una sesión empezada pero sin cerrar no cuenta', () => {
    expect(
      sessionStreak({ days, sessions: [session('a', false)], week: 1, dayIndex: 1 }),
    ).toBe(0)
  })

  it('ignora los días futuros del plan', () => {
    expect(
      sessionStreak({
        days,
        sessions: [session('a', true), session('d', true)],
        week: 1,
        dayIndex: 1,
      }),
    ).toBe(1)
  })
})
