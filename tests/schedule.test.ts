import { describe, it, expect } from 'vitest'
import { mondayOf, pendingDay, planMoves } from '@/lib/schedule'
import { currentWeek } from '@/lib/supabase/queries'
import type { Program, ProgramDay } from '@/lib/supabase/types'

describe('mondayOf', () => {
  it('un miércoles cae en el lunes de su semana', () => {
    const m = mondayOf(new Date(2026, 8, 23)) // miércoles 23 sep 2026
    expect([m.getFullYear(), m.getMonth(), m.getDate()]).toEqual([2026, 8, 21])
  })

  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    const m = mondayOf(new Date(2026, 8, 27))
    expect(m.getDate()).toBe(21)
  })

  it('un lunes es su propio lunes', () => {
    expect(mondayOf(new Date(2026, 8, 21, 18)).getDate()).toBe(21)
  })
})

describe('currentWeek con semanas en lunes', () => {
  const program = { starts_on: '2026-09-23', weeks: 4 } as Program

  it('el bloque nacido un miércoles sigue en semana 1 el domingo', () => {
    expect(currentWeek(program, new Date(2026, 8, 27, 12))).toBe(1)
  })

  // Antes contaba siete días desde el miércoles: el lunes seguía siendo semana
  // 1 y la vista de la semana tomaba el miércoles pasado por un día próximo.
  it('el lunes siguiente ya es semana 2', () => {
    expect(currentWeek(program, new Date(2026, 8, 28, 9))).toBe(2)
  })
})

describe('planMoves', () => {
  const apply = (start: number[], moves: { from: number; to: number }[]) => {
    const occupied = new Set(start)
    for (const m of moves) {
      expect(occupied.has(m.to), `destino ${m.to} ocupado`).toBe(false)
      expect(occupied.has(m.from), `origen ${m.from} vacío`).toBe(true)
      occupied.delete(m.from)
      occupied.add(m.to)
    }
    return [...occupied].sort((a, b) => a - b)
  }

  it('sin cambios no mueve nada', () => {
    expect(planMoves([1, 3, 5], [1, 3, 5])).toEqual([])
  })

  it('mueve a un día libre directamente', () => {
    const moves = planMoves([1, 2, 4, 5], [1, 3, 4, 5])
    expect(moves).toEqual([{ from: 2, to: 3 }])
  })

  it('un desplazamiento en cadena nunca pisa un día ocupado', () => {
    const start = [1, 2, 4, 5]
    const target = [2, 3, 5, 6]
    expect(apply(start, planMoves(start, target))).toEqual(target)
  })

  it('con más días de los que caben en orden, empareja por posición', () => {
    // El 1.º entrenamiento va al 1.er día elegido, el 2.º al 2.º...
    const start = [1, 2, 4, 5]
    const target = [1, 3, 5, 6]
    expect(apply(start, planMoves(start, target))).toEqual(target)
  })

  it('un ciclo se rompe usando un día libre', () => {
    // Emparejado por orden, [1,3,5] → [3,5,7] obliga a mover en cadena; con
    // [2,4,6] → [2,4,6] no hay nada. El caso difícil es el que se pisa a sí mismo.
    const start = [1, 2, 3, 4, 5, 6]
    const target = [2, 3, 4, 5, 6, 7]
    expect(apply(start, planMoves(start, target))).toEqual(target)
  })

  it('con los siete días no hay nada que mover', () => {
    expect(planMoves([1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])).toEqual([])
  })
})

describe('pendingDay', () => {
  const day = (id: string, week: number, day_index: number): ProgramDay => ({
    id,
    program_id: 'p',
    week,
    day_index,
    title: id,
    focus: [],
    is_deload: false,
  })
  const days = [day('lun', 1, 1), day('mar', 1, 2), day('jue', 1, 4), day('lun2', 2, 1)]

  it('el primero sin hacer de la semana, por orden', () => {
    expect(pendingDay(days, new Set(['lun']), 1, 3)?.id).toBe('mar')
  })

  it('no ofrece el de hoy: ese ya se enseña como el día', () => {
    expect(pendingDay(days, new Set(['lun']), 1, 2)?.id).toBe('jue')
  })

  it('con la semana hecha no hay pendiente', () => {
    expect(pendingDay(days, new Set(['lun', 'mar', 'jue']), 1, 3)).toBeNull()
  })

  it('no mira otras semanas', () => {
    expect(pendingDay(days, new Set(['lun', 'mar', 'jue']), 1, 7)).toBeNull()
  })
})
