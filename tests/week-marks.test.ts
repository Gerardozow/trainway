import { describe, it, expect } from 'vitest'
import { weekMarks } from '@/lib/history'
import type { ProgramDay, WorkoutSession } from '@/lib/supabase/types'

/**
 * La semana en siete marcas.
 *
 * Lo que llena el día de descanso, que era una pantalla vacía. Aquí lo único
 * que importa es que cada casilla diga la verdad: prevista, hecha, saltada o
 * descanso, y sin confundir "todavía no" con "ya no".
 */

const day = (dayIndex: number, id = `d${dayIndex}`, week = 1): ProgramDay => ({
  id,
  program_id: 'p1',
  week,
  day_index: dayIndex,
  title: `Día ${dayIndex}`,
  focus: ['chest'],
  is_deload: false,
})

const session = (programDayId: string, completed: boolean): WorkoutSession => ({
  id: `s-${programDayId}`,
  user_id: 'u1',
  program_day_id: programDayId,
  performed_on: '2026-08-10',
  started_at: '2026-08-10T18:00:00.000Z',
  completed_at: completed ? '2026-08-10T19:00:00.000Z' : null,
  session_rpe: null,
  notes: null,
})

// Lunes, miércoles y viernes.
const PLAN = [day(1), day(3), day(5)]

describe('weekMarks', () => {
  it('siempre son siete, de lunes a domingo', () => {
    const marks = weekMarks({ days: PLAN, sessions: [], week: 1, dayIndex: 1 })
    expect(marks).toHaveLength(7)
    expect(marks.map((m) => m.initial)).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D'])
  })

  it('distingue día de entrenamiento de día de descanso', () => {
    const marks = weekMarks({ days: PLAN, sessions: [], week: 1, dayIndex: 1 })
    expect(marks.filter((m) => m.planned).map((m) => m.dayIndex)).toEqual([1, 3, 5])
  })

  it('solo cuenta como hecho lo que se cerró', () => {
    const marks = weekMarks({
      days: PLAN,
      sessions: [session('d1', true), session('d3', false)],
      week: 1,
      dayIndex: 5,
    })

    expect(marks[0]!.done).toBe(true)
    // Empezada y no cerrada no es entrenada: el lunes a medias no cuenta.
    expect(marks[2]!.done).toBe(false)
  })

  it('lo que ya pasó sin hacerse queda saltado; lo de hoy todavía no', () => {
    const marks = weekMarks({ days: PLAN, sessions: [], week: 1, dayIndex: 3 })

    expect(marks[0]!.missed).toBe(true) // el lunes ya pasó
    expect(marks[2]!.missed).toBe(false) // hoy es miércoles, aún puede entrenarse
    expect(marks[4]!.missed).toBe(false) // el viernes no ha llegado
  })

  it('un día de descanso nunca está saltado', () => {
    const marks = weekMarks({ days: PLAN, sessions: [], week: 1, dayIndex: 7 })
    expect(marks[1]!.missed).toBe(false)
    expect(marks[1]!.planned).toBe(false)
  })

  it('señala hoy una sola vez', () => {
    const marks = weekMarks({ days: PLAN, sessions: [], week: 1, dayIndex: 4 })
    expect(marks.filter((m) => m.today).map((m) => m.dayIndex)).toEqual([4])
  })

  it('no mezcla semanas del bloque', () => {
    const marks = weekMarks({
      days: [...PLAN, day(2, 'otra', 2)],
      sessions: [session('otra', true)],
      week: 1,
      dayIndex: 1,
    })

    // El martes de la semana 2 no pinta nada en la semana 1.
    expect(marks[1]!.planned).toBe(false)
  })

  it('lleva el título para poder nombrar la marca', () => {
    const marks = weekMarks({ days: PLAN, sessions: [], week: 1, dayIndex: 1 })
    expect(marks[0]!.title).toBe('Día 1')
    expect(marks[1]!.title).toBeNull()
  })
})
