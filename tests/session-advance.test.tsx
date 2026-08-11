import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DayWithExercises, ProgramExercise } from '@/lib/supabase/types'

/**
 * El avance automático de la pantalla de sesión.
 *
 * Se monta la pantalla entera con la base de datos simulada: lo que se prueba
 * es la coreografía —qué se abre, qué se cierra y adónde se mueve la vista—,
 * que es justo lo que no se puede comprobar con funciones puras.
 */

const PRESS = 'Barbell_Bench_Press_-_Medium_Grip'
const REMO = 'Bent_Over_Barbell_Row'

const exercise = (id: string, exerciseId: string, position: number): ProgramExercise => ({
  id,
  program_day_id: 'pd1',
  exercise_id: exerciseId,
  category: 'strength',
  position,
  target_sets: 2,
  target_reps: '8-10',
  target_weight: 60,
  target_duration_seconds: null,
  target_rpe: null,
  rest_seconds: 90,
  progression_scheme: { type: 'double', incrementKg: 2.5 },
  coach_note: null,
})

const day: DayWithExercises = {
  id: 'pd1',
  program_id: 'p1',
  week: 1,
  day_index: 1,
  title: 'Empuje',
  focus: ['chest'],
  is_deload: false,
  exercises: [exercise('pe1', PRESS, 1), exercise('pe2', REMO, 2)],
}

vi.mock('@/lib/supabase/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: null, loading: false }),
}))

vi.mock('@/components/MuscleMap', () => ({ MuscleMap: () => <div /> }))

vi.mock('@/lib/useWakeLock', () => ({ useWakeLock: () => {} }))

vi.mock('@/lib/api', () => ({ translateExercises: vi.fn() }))

vi.mock('@/lib/supabase/queries', () => ({
  getDayWithExercises: vi.fn(async () => day),
  getHistoryFor: vi.fn(async () => ({})),
  getTranslations: vi.fn(async () => ({})),
  getProfile: vi.fn(async () => ({ units: 'metric' })),
  getLatestIntake: vi.fn(async () => ({ equipment: ['barbell'] })),
  startSession: vi.fn(async () => ({ id: 'sesion1' })),
  completeSession: vi.fn(),
  swapExercise: vi.fn(),
}))

vi.mock('@/lib/offline', () => ({
  db: { cachedDays: { put: vi.fn() } },
  enqueueSet: vi.fn(),
  localSetsForSession: vi.fn(async () => []),
  scheduleFlush: vi.fn(),
  syncNow: vi.fn(async () => ({ synced: 0, failed: 0 })),
  startSync: vi.fn(() => () => {}),
}))

const { Session } = await import('@/routes/Session')

function renderSession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/sesion/pd1']}>
        <Routes>
          <Route path="/sesion/:programDayId" element={<Session />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** La cabecera de la tarjeta abierta. Es lo que define "en qué ejercicio estoy". */
function abierta() {
  return screen.getAllByRole('button', { expanded: true })[0]
}

describe('avance automático de la sesión', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('abre el primer ejercicio sin terminar', async () => {
    renderSession()
    await waitFor(() => expect(abierta()).toBeDefined())
    expect(abierta()!).toHaveTextContent(/Bench Press/i)
  })

  it('al terminar un ejercicio abre el siguiente y mueve la vista', async () => {
    const user = userEvent.setup()
    renderSession()

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Marcar serie/ })).toHaveLength(2))

    for (const boton of screen.getAllByRole('button', { name: /^Marcar serie/ })) {
      await user.click(boton)
    }

    await waitFor(() => expect(abierta()!).toHaveTextContent(/Row/i), { timeout: 3000 })
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalled(), { timeout: 3000 })
  })

  it('posponer manda el ejercicio al final y abre el siguiente', async () => {
    const user = userEvent.setup()
    renderSession()

    await waitFor(() => expect(abierta()).toBeDefined())
    await user.click(screen.getByRole('button', { name: /dejarlo para el final/i }))

    // Se abre el remo...
    await waitFor(() => expect(abierta()!).toHaveTextContent(/Row/i))

    // ...y el press pasa a ser la última tarjeta.
    const titulos = screen.getAllByRole('button', { expanded: false })
    expect(titulos.at(-1)!).toHaveTextContent(/Bench Press/i)
  })

  it('el ejercicio terminado se cierra y deja de ocupar sitio', async () => {
    const user = userEvent.setup()
    renderSession()

    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Marcar serie/ })).toHaveLength(2))
    for (const boton of screen.getAllByRole('button', { name: /^Marcar serie/ })) {
      await user.click(boton)
    }

    await waitFor(() => expect(abierta()!).toHaveTextContent(/Row/i), { timeout: 3000 })

    // La tarjeta cerrada resume sin desplegar: 2 de 2 y ni una fila de series.
    const cerrada = screen.getAllByRole('button', { expanded: false })[0]!
    expect(within(cerrada).getByText(/Bench Press/i)).toBeInTheDocument()
  })
})
