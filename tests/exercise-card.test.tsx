import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseCard } from '@/components/ExerciseCard'
import type { PreviousSession } from '@/lib/history'
import type { ProgramExercise } from '@/lib/supabase/types'
import type { Target } from '@/lib/progression'
import type { SetValues } from '@/components/SetRow'

// La silueta muscular es una librería imperativa que pinta SVG; en jsdom no
// aporta nada y ensucia la salida. Lo que se prueba aquí es la tarjeta.
vi.mock('@/components/MuscleMap', () => ({
  MuscleMap: () => <div data-testid="mapa-muscular" />,
}))

const BARBELL = 'Barbell_Bench_Press_-_Medium_Grip'
const CURL = 'Alternate_Hammer_Curl'

const exercise = (overrides: Partial<ProgramExercise> = {}): ProgramExercise => ({
  id: 'pe1',
  program_day_id: 'pd1',
  exercise_id: BARBELL,
  category: 'strength',
  position: 1,
  target_sets: 3,
  target_reps: '8-10',
  target_weight: 60,
  target_duration_seconds: null,
  target_rpe: null,
  rest_seconds: 90,
  progression_scheme: { type: 'double', incrementKg: 2.5 },
  coach_note: null,
  ...overrides,
})

const target: Target = {
  sets: 3,
  repRange: [8, 10],
  weight: 60,
  durationSeconds: null,
  note: null,
}

const emptySets = (n: number): SetValues[] =>
  Array.from({ length: n }, () => ({
    weight: 60,
    reps: 8,
    durationSeconds: null,
    intensity: null,
    done: false,
  }))

const previous: PreviousSession = {
  date: '2026-08-03',
  daysAgo: 7,
  sets: [
    { weight: 57.5, reps: 10, durationSeconds: null },
    { weight: 57.5, reps: 9, durationSeconds: null },
    { weight: 57.5, reps: 8, durationSeconds: null },
  ],
}

function renderCard(props: Partial<Parameters<typeof ExerciseCard>[0]> = {}) {
  return render(
    <ExerciseCard
      exercise={exercise()}
      translation={undefined}
      target={target}
      sets={emptySets(3)}
      units="metric"
      expanded
      onToggleExpand={vi.fn()}
      onChangeSet={vi.fn()}
      onToggleDone={vi.fn()}
      onSwap={vi.fn()}
      {...props}
    />,
  )
}

describe('ExerciseCard', () => {
  it('enseña lo que se hizo la última vez', () => {
    renderCard({ previous })
    expect(screen.getByText(/La vez pasada · hace 7 días/i)).toBeInTheDocument()
    expect(screen.getByText('57.5 kg × 10 · 9 · 8')).toBeInTheDocument()
  })

  it('sin historial no inventa una referencia', () => {
    renderCard({ previous: null })
    expect(screen.queryByText(/La vez pasada/i)).not.toBeInTheDocument()
  })

  it('colapsada no gasta sitio en el historial', () => {
    renderCard({ previous, expanded: false })
    expect(screen.queryByText(/La vez pasada/i)).not.toBeInTheDocument()
  })

  it('propone calentamiento en un básico con barra', () => {
    renderCard()
    expect(screen.getByText(/Calentamiento/i)).toBeInTheDocument()
    expect(screen.getByText(/20 × 10/)).toBeInTheDocument()
  })

  it('no propone calentamiento en un ejercicio de aislamiento', () => {
    renderCard({ exercise: exercise({ exercise_id: CURL }) })
    expect(screen.queryByText(/Calentamiento/i)).not.toBeInTheDocument()
  })

  it('sin peso todavía no hay rampa que calcular', () => {
    renderCard({ target: { ...target, weight: null } })
    expect(screen.queryByText(/Calentamiento/i)).not.toBeInTheDocument()
  })

  it('al editar el peso enseña los discos por lado', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getAllByRole('button', { name: 'Editar peso' })[0]!)

    expect(screen.getByText('Por lado')).toBeInTheDocument()
    // 60 kg = barra de 20 + 20 por lado.
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  it('en mancuernas no habla de discos', async () => {
    const user = userEvent.setup()
    renderCard({ exercise: exercise({ exercise_id: CURL }) })

    await user.click(screen.getAllByRole('button', { name: 'Editar peso' })[0]!)

    expect(screen.queryByText('Por lado')).not.toBeInTheDocument()
  })

  it('al editar enseña esa misma serie de la vez pasada', async () => {
    const user = userEvent.setup()
    renderCard({ previous })

    await user.click(screen.getAllByRole('button', { name: 'Editar repeticiones' })[1]!)

    expect(screen.getByText(/La vez pasada:/)).toBeInTheDocument()
    expect(screen.getByText('57.5 kg × 9')).toBeInTheDocument()
  })
})
