import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Intake, ProgramDay } from '@/lib/supabase/types'

const intake: Intake = {
  id: 'i0',
  user_id: 'u1',
  goal: 'hipertrofia',
  days_per_week: 4,
  session_minutes: 60,
  experience: 'intermedio',
  equipment: ['barbell'],
  focus_muscles: [],
  include_cardio: true,
  limitations: null,
  free_notes: null,
  created_at: '2026-09-01T00:00:00Z',
} as Intake

const programDays: ProgramDay[] = [1, 2].flatMap((week) =>
  [1, 2, 4, 5].map((day_index) => ({
    id: `w${week}d${day_index}`,
    program_id: 'p1',
    week,
    day_index,
    title: 'Día',
    focus: [],
    is_deload: false,
  })),
)

const createIntake = vi.fn(async (row: Record<string, unknown>) => ({ ...row, id: 'i1' }))
const moveProgramDays = vi.fn(async () => {})
const generatePlan = vi.fn(async () => ({ program_id: 'p2', name: '', rationale: '', exercise_ids: [] }))

vi.mock('@/lib/supabase/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/supabase/queries', () => ({
  getLatestIntake: async () => intake,
  getActiveProgram: async () => ({ id: 'p1' }),
  getProgramDays: async () => programDays,
  createIntake: (r: Record<string, unknown>) => createIntake(r),
  moveProgramDays: (...a: unknown[]) => moveProgramDays(...(a as [])),
}))
vi.mock('@/lib/api', () => ({
  generatePlan: (...a: unknown[]) => generatePlan(...(a as [])),
  translateExercises: async () => {},
}))

const { Preferences } = await import('@/routes/Preferences')

const renderPrefs = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Preferences />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const day = (name: string) => screen.getByRole('button', { name })

describe('Preferencias: tus días', () => {
  beforeEach(() => {
    createIntake.mockClear()
    moveProgramDays.mockClear()
    generatePlan.mockClear()
  })

  it('empieza con los días del plan activo', async () => {
    renderPrefs()
    await waitFor(() => expect(day('Lunes')).toHaveAttribute('aria-pressed', 'true'))
    expect(day('Martes')).toHaveAttribute('aria-pressed', 'true')
    expect(day('Miércoles')).toHaveAttribute('aria-pressed', 'false')
    expect(day('Viernes')).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiar de martes a miércoles reacomoda el bloque sin rehacerlo', async () => {
    renderPrefs()
    await waitFor(() => expect(day('Martes')).toHaveAttribute('aria-pressed', 'true'))
    await userEvent.click(day('Martes'))
    await userEvent.click(day('Miércoles'))
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => expect(moveProgramDays).toHaveBeenCalledWith('p1', [1, 2, 4, 5], [1, 3, 4, 5]))
    expect(createIntake).toHaveBeenCalledWith(expect.objectContaining({ days_per_week: 4 }))
    expect(generatePlan).not.toHaveBeenCalled()
  })

  it('con otra cantidad de días avisa que hay que rehacer el bloque', async () => {
    renderPrefs()
    await waitFor(() => expect(day('Sábado')).toHaveAttribute('aria-pressed', 'false'))
    await userEvent.click(day('Sábado'))

    expect(screen.getByText(/para aplicar 5 días hay que rehacer el bloque/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    await waitFor(() => expect(createIntake).toHaveBeenCalled())
    expect(moveProgramDays).not.toHaveBeenCalled()
  })

  it('rehacer el bloque manda los días elegidos', async () => {
    renderPrefs()
    await waitFor(() => expect(day('Sábado')).toHaveAttribute('aria-pressed', 'false'))
    await userEvent.click(day('Sábado'))
    await userEvent.click(screen.getByRole('button', { name: /rehacer con estos cambios/i }))
    await userEvent.click(screen.getByRole('button', { name: /sí, rehacer/i }))

    await waitFor(() => expect(generatePlan).toHaveBeenCalledWith('i1', { days: [1, 2, 4, 5, 6] }))
  })
})
