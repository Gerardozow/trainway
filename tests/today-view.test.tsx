import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TodayView } from '@/routes/Today'
import { isoDayIndex, todayISO } from '@/lib/utils'
import type { Program, ProgramDay, ProgramExercise, WorkoutSession } from '@/lib/supabase/types'

// Hoy tira de componentes con red o con el service worker; aquí se prueba el
// reparto de la pantalla, no ellos.
vi.mock('@/components/SyncIndicator', () => ({ SyncIndicator: () => null }))
vi.mock('@/components/InstallCard', () => ({ InstallBanner: () => null }))
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => null }))

const day: ProgramDay = {
  id: 'pd1',
  program_id: 'p1',
  week: 1,
  day_index: isoDayIndex(),
  title: 'Tren inferior',
  focus: ['quadriceps'],
  is_deload: false,
}

const exercise: ProgramExercise = {
  id: 'pe1',
  program_day_id: 'pd1',
  exercise_id: 'Leg_Press',
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
}

const program = { id: 'p1', name: 'Programa', weeks: 4, block_number: 1 } as Program

const data = (sessions: WorkoutSession[] = []) =>
  ({
    program,
    week: 1,
    day,
    days: [day],
    exercises: [exercise],
    translations: {
      Leg_Press: {
        exercise_id: 'Leg_Press',
        locale: 'es',
        name: 'Prensa de piernas',
        instructions: ['Empuja.'],
      },
    },
    sessions,
    upcoming: [],
    offline: false,
  }) as unknown as Parameters<typeof TodayView>[0]['data']

const renderToday = (sessions?: WorkoutSession[]) =>
  render(
    <MemoryRouter>
      <TodayView data={data(sessions)} isFetching={false} />
    </MemoryRouter>,
  )

describe('Hoy', () => {
  it('enseña cada ejercicio con sus dos fotos y la dosis con descanso', () => {
    renderToday()
    expect(screen.getByAltText('Prensa de piernas, posición inicial')).toBeInTheDocument()
    expect(screen.getByAltText('Prensa de piernas, posición final')).toBeInTheDocument()
    expect(screen.getByText('3 × 10-12 · 90 s')).toBeInTheDocument()
  })

  it('tocar el ejercicio entra al entreno', () => {
    renderToday()
    expect(screen.getByRole('link', { name: /prensa de piernas/i })).toHaveAttribute(
      'href',
      '/sesion/pd1',
    )
  })

  it('con la sesión de hoy terminada el ejercicio ya no enlaza', () => {
    renderToday([
      {
        id: 's1',
        user_id: 'u1',
        program_day_id: 'pd1',
        performed_on: todayISO(),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        session_rpe: null,
        notes: null,
      },
    ])
    expect(screen.queryByRole('link', { name: /prensa de piernas/i })).not.toBeInTheDocument()
  })

  it('enseña la semana también en día de entrenamiento', () => {
    renderToday()
    expect(screen.getByText('Esta semana')).toBeInTheDocument()
  })
})
