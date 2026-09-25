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
// Siempre miércoles: "recuperar" o "adelantar" depende del día en que se mire.
vi.mock('@/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils')>()),
  isoDayIndex: () => 3,
}))

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
    expect(screen.getByText('3 × 10-12 · descanso 90 s')).toBeInTheDocument()
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

describe('Hoy con un día adelantado', () => {
  // Se adelantó el entrenamiento de hoy otro día: ya está hecho, aunque la
  // sesión tenga otra fecha.
  it('no vuelve a ofrecer el entrenamiento de hoy', () => {
    renderToday([
      {
        id: 's1',
        user_id: 'u1',
        program_day_id: 'pd1',
        performed_on: '2026-01-01',
        started_at: '2026-01-01T10:00:00Z',
        completed_at: '2026-01-01T11:00:00Z',
        session_rpe: null,
        notes: null,
      },
    ])
    expect(screen.queryByRole('link', { name: /empezar entrenamiento/i })).not.toBeInTheDocument()
    expect(screen.getByText('Hecho. Nos vemos la próxima.')).toBeInTheDocument()
  })
})

describe('Hoy sin entrenamiento pero con algo pendiente', () => {
  // Miércoles: el plan tiene lunes, martes y jueves.
  const d = (id: string, day_index: number, title: string): ProgramDay => ({
    id,
    program_id: 'p1',
    week: 1,
    day_index,
    title,
    focus: ['quadriceps'],
    is_deload: false,
  })
  const lun = d('lun', 1, 'Tren superior')
  const mar = d('mar', 2, 'Tren inferior')
  const jue = d('jue', 4, 'Espalda')

  const done = (programDayId: string): WorkoutSession => ({
    id: `s-${programDayId}`,
    user_id: 'u1',
    program_day_id: programDayId,
    performed_on: '2026-09-21',
    started_at: '2026-09-21T10:00:00Z',
    completed_at: '2026-09-21T11:00:00Z',
    session_rpe: null,
    notes: null,
  })

  const pendingData = (pending: ProgramDay | null, sessions: WorkoutSession[]) =>
    ({
      program,
      week: 1,
      day: null,
      pending,
      days: [lun, mar, jue],
      exercises: pending ? [{ ...exercise, program_day_id: pending.id }] : [],
      translations: {},
      sessions,
      upcoming: [jue],
      offline: false,
    }) as unknown as Parameters<typeof TodayView>[0]['data']

  const renderPending = (pending: ProgramDay | null, sessions: WorkoutSession[] = []) =>
    render(
      <MemoryRouter>
        <TodayView data={pendingData(pending, sessions)} isFetching={false} />
      </MemoryRouter>,
    )

  it('ofrece recuperar un día que ya pasó', () => {
    renderPending(mar, [done('lun')])
    expect(screen.getByText(/hoy no estaba en tu plan/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tren inferior' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /recuperar el martes/i })).toHaveAttribute(
      'href',
      '/sesion/mar',
    )
  })

  it('ofrece adelantar uno que viene', () => {
    renderPending(jue, [done('lun'), done('mar')])
    expect(screen.getByRole('link', { name: /adelantar el jueves/i })).toHaveAttribute(
      'href',
      '/sesion/jue',
    )
  })

  it('las tarjetas del día pendiente también entran al entreno', () => {
    renderPending(mar, [done('lun')])
    expect(screen.getByRole('link', { name: /leg press/i })).toHaveAttribute('href', '/sesion/mar')
  })

  // Recuperar el martes el miércoles ya es el entreno de hoy: ofrecer también
  // el jueves invitaba a hacer dos seguidos.
  it('después de recuperar un día, hoy no ofrece otro', () => {
    renderPending(jue, [done('lun'), { ...done('mar'), performed_on: todayISO() }])
    expect(screen.queryByRole('link', { name: /adelantar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/hecho por hoy/i)).toBeInTheDocument()
  })

  it('con la semana hecha es día de descanso', () => {
    renderPending(null, [done('lun'), done('mar'), done('jue')])
    expect(screen.getByText('Hoy toca descansar')).toBeInTheDocument()
  })
})
