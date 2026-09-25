import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { PlanWeek } from '@/components/PlanWeek'
import { defaultDayId } from '@/lib/planView'
import type { ProgramDay, ProgramExercise } from '@/lib/supabase/types'

const day = (id: string, week: number, day_index: number, title: string): ProgramDay => ({
  id,
  program_id: 'p1',
  week,
  day_index,
  title,
  focus: ['chest'],
  is_deload: week === 4,
})

const ex = (id: string, program_day_id: string, exercise_id: string): ProgramExercise => ({
  id,
  program_day_id,
  exercise_id,
  category: 'strength',
  position: 1,
  target_sets: 3,
  target_reps: '10-12',
  target_weight: null,
  target_duration_seconds: null,
  target_rpe: null,
  rest_seconds: 90,
  progression_scheme: { type: 'double', incrementKg: 2.5 },
  coach_note: null,
})

const DAYS = [
  day('w1d1', 1, 1, 'Tren superior'),
  day('w1d3', 1, 3, 'Tren inferior'),
  day('w2d1', 2, 1, 'Superior S2'),
  day('w2d3', 2, 3, 'Inferior S2'),
  day('w4d1', 4, 1, 'Superior descarga'),
]

const EXERCISES = [
  ex('e1', 'w1d1', 'Barbell_Bench_Press_-_Medium_Grip'),
  ex('e2', 'w1d3', 'Leg_Press'),
  ex('e3', 'w2d1', 'Barbell_Bench_Press_-_Medium_Grip'),
  ex('e4', 'w2d3', 'Leg_Press'),
  ex('e5', 'w4d1', 'Barbell_Bench_Press_-_Medium_Grip'),
]

const renderWeek = (completed: string[] = [], currentWeek = 1) =>
  render(
    <MemoryRouter>
      <PlanWeek
        days={DAYS}
        exercises={EXERCISES}
        translations={{}}
        completed={new Set(completed)}
        weeks={4}
        currentWeek={currentWeek}
      />
    </MemoryRouter>,
  )

const detail = () => screen.getByRole('region', { name: /día seleccionado/i })

describe('defaultDayId', () => {
  it('elige el primer día pendiente por orden de la semana', () => {
    const days = [day('b', 1, 3, 'B'), day('a', 1, 1, 'A')]
    expect(defaultDayId(days, new Set(['a']))).toBe('b')
  })

  it('con todo hecho vuelve al primero', () => {
    const days = [day('b', 1, 3, 'B'), day('a', 1, 1, 'A')]
    expect(defaultDayId(days, new Set(['a', 'b']))).toBe('a')
  })

  it('una semana vacía no tiene día', () => {
    expect(defaultDayId([], new Set())).toBeNull()
  })
})

describe('PlanWeek', () => {
  it('abre en la semana actual con el primer día pendiente', () => {
    renderWeek(['w1d1'])
    expect(within(detail()).getByRole('heading', { name: 'Tren inferior' })).toBeInTheDocument()
    expect(within(detail()).getByRole('heading', { name: 'Leg Press' })).toBeInTheDocument()
  })

  it('tocar un día cambia el detalle', async () => {
    renderWeek()
    await userEvent.click(screen.getByRole('button', { name: /tren inferior/i }))
    expect(within(detail()).getByRole('heading', { name: 'Leg Press' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /entrenar este día/i })).toHaveAttribute(
      'href',
      '/sesion/w1d3',
    )
  })

  it('cambiar de semana reinicia la selección', async () => {
    renderWeek()
    await userEvent.click(screen.getByRole('button', { name: /tren inferior/i }))
    await userEvent.click(screen.getByRole('tab', { name: /semana 2/i }))
    expect(within(detail()).getByRole('heading', { name: 'Superior S2' })).toBeInTheDocument()
  })

  it('marca la semana de descarga', () => {
    renderWeek()
    expect(screen.getByRole('tab', { name: /semana 4.*descarga/i })).toBeInTheDocument()
  })

  it('una semana sin días no ofrece entrenar', async () => {
    renderWeek()
    await userEvent.click(screen.getByRole('tab', { name: /semana 3/i }))
    expect(screen.queryByRole('link', { name: /entrenar este día/i })).not.toBeInTheDocument()
  })

  // Entrar a /sesion de un día ya hecho no enseña lo que se hizo: abre una
  // sesión nueva con fecha de hoy y las series vacías.
  it('un día ya hecho no ofrece entrar a la sesión', () => {
    renderWeek(['w1d1'])
    return userEvent.click(screen.getByRole('button', { name: /tren superior/i })).then(() => {
      expect(within(detail()).queryByRole('link')).not.toBeInTheDocument()
      expect(within(detail()).getByText(/día completado/i)).toBeInTheDocument()
    })
  })

  it('en un día pendiente, tocar un ejercicio entra al entreno', () => {
    renderWeek()
    expect(within(detail()).getByRole('link', { name: /bench press/i })).toHaveAttribute(
      'href',
      '/sesion/w1d1',
    )
  })

  it('enseña el progreso de la semana', () => {
    renderWeek(['w1d1'])
    expect(screen.getByText(/1 de 2 entrenamientos/i)).toBeInTheDocument()
  })
})
