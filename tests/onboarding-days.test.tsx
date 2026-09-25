import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createIntake = vi.fn(async (row: Record<string, unknown>) => ({ id: 'i1', ...row }))
const generatePlan = vi.fn(async () => ({ program_id: 'p', name: 'x', rationale: '', exercise_ids: [] }))

vi.mock('@/lib/supabase/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/supabase/queries', () => ({ createIntake: (r: Record<string, unknown>) => createIntake(r) }))
vi.mock('@/lib/api', () => ({
  generatePlan: (...args: unknown[]) => generatePlan(...(args as [])),
  translateExercises: async () => {},
}))

const { Onboarding } = await import('@/routes/Onboarding')

const renderOnboarding = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const siguiente = () => screen.getByRole('button', { name: /siguiente/i })

describe('cuestionario: qué días vas', () => {
  it('pregunta los días y no deja seguir con menos de dos', async () => {
    renderOnboarding()
    await userEvent.click(screen.getAllByRole('button', { pressed: false })[0]!)
    await userEvent.click(siguiente())

    expect(screen.getByRole('heading', { name: /qué días vas/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Lunes' }))
    expect(siguiente()).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Miércoles' }))
    expect(siguiente()).toBeEnabled()
  })

  it('guarda cuántos días y pide el plan con esos días', async () => {
    renderOnboarding()
    await userEvent.click(screen.getAllByRole('button', { pressed: false })[0]!)
    await userEvent.click(siguiente())

    for (const d of ['Lunes', 'Miércoles', 'Viernes', 'Sábado']) {
      await userEvent.click(screen.getByRole('button', { name: d }))
    }
    await userEvent.click(siguiente())
    await userEvent.click(screen.getAllByRole('button', { pressed: false })[0]!) // minutos
    await userEvent.click(siguiente())
    await userEvent.click(screen.getAllByRole('button', { pressed: false })[0]!) // experiencia
    await userEvent.click(siguiente())
    await userEvent.click(screen.getAllByRole('button', { pressed: false })[0]!) // equipo
    await userEvent.click(siguiente())
    await userEvent.click(screen.getByRole('button', { name: /crear mi plan/i }))

    await waitFor(() => expect(generatePlan).toHaveBeenCalled())
    expect(createIntake).toHaveBeenCalledWith(expect.objectContaining({ days_per_week: 4 }))
    expect(generatePlan).toHaveBeenCalledWith('i1', { days: [1, 3, 5, 6] })
  })
})
