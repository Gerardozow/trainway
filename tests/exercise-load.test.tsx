import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseCard } from '@/components/ExerciseCard'
import type { ProgramExercise } from '@/lib/supabase/types'
import type { Target } from '@/lib/progression'
import type { SetValues } from '@/components/SetRow'

/**
 * El control de carga del ejercicio.
 *
 * La queja que lo trajo: había que repetir el peso en cada serie. Lo que se
 * comprueba aquí es que existe un único sitio donde ponerlo, que se refiere a
 * la próxima serie y que desaparece cuando ya no queda ninguna.
 */

vi.mock('@/components/MuscleMap', () => ({ MuscleMap: () => <div /> }))

const exercise: ProgramExercise = {
  id: 'pe1',
  program_day_id: 'pd1',
  exercise_id: 'Barbell_Bench_Press_-_Medium_Grip',
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
}

const target: Target = { sets: 3, repRange: [8, 10], weight: 60, durationSeconds: null, note: null }

const set = (weight: number, done: boolean): SetValues => ({
  weight,
  reps: 8,
  durationSeconds: null,
  intensity: null,
  done,
})

function renderCard(sets: SetValues[], onChangeAll = vi.fn()) {
  render(
    <ExerciseCard
      exercise={exercise}
      translation={undefined}
      target={target}
      sets={sets}
      units="metric"
      expanded
      onToggleExpand={vi.fn()}
      onChangeSet={vi.fn()}
      onChangeAll={onChangeAll}
      onToggleDone={vi.fn()}
      onSwap={vi.fn()}
    />,
  )
  return onChangeAll
}

describe('carga por ejercicio', () => {
  it('un solo control para todas las series', () => {
    renderCard([set(60, false), set(60, false), set(60, false)])
    expect(screen.getByRole('button', { name: 'Editar peso de todas las series' })).toBeVisible()
  })

  it('enseña el peso de la próxima serie, no el de la primera', () => {
    // Las dos primeras se hicieron a 60; la tercera se bajó a 50.
    renderCard([set(60, true), set(60, true), set(50, false)])

    const control = screen.getByRole('button', { name: 'Editar peso de todas las series' })
    expect(control).toHaveTextContent('50')
  })

  it('dice a cuántas series afecta', async () => {
    const user = userEvent.setup()
    renderCard([set(60, true), set(60, false), set(60, false)])

    await user.click(screen.getByRole('button', { name: 'Editar peso de todas las series' }))
    expect(screen.getByText('Se aplica a las 2 series que faltan')).toBeInTheDocument()
  })

  it('con una sola serie pendiente lo dice en singular', async () => {
    const user = userEvent.setup()
    renderCard([set(60, true), set(60, false)])

    await user.click(screen.getByRole('button', { name: 'Editar peso de todas las series' }))
    expect(screen.getByText('Se aplica a la serie que falta')).toBeInTheDocument()
  })

  it('subir el peso avisa una vez, no una por serie', async () => {
    const user = userEvent.setup()
    const onChangeAll = renderCard([set(60, false), set(60, false), set(60, false)])

    await user.click(screen.getByRole('button', { name: 'Editar peso de todas las series' }))
    await user.click(screen.getByRole('button', { name: 'Subir peso de todas las series' }))

    expect(onChangeAll).toHaveBeenCalledTimes(1)
    expect(onChangeAll).toHaveBeenCalledWith({ weight: 62.5 })
  })

  it('con todo marcado no queda nada que ajustar', () => {
    renderCard([set(60, true), set(60, true)])
    expect(
      screen.queryByRole('button', { name: 'Editar peso de todas las series' }),
    ).not.toBeInTheDocument()
  })

  it('los discos también salen en el control del ejercicio', async () => {
    const user = userEvent.setup()
    renderCard([set(60, false), set(60, false)])

    await user.click(screen.getByRole('button', { name: 'Editar peso de todas las series' }))
    expect(screen.getByText('Por lado')).toBeInTheDocument()
  })

  it('sigue habiendo edición serie a serie para el caso raro', () => {
    renderCard([set(60, false), set(60, false)])
    expect(screen.getAllByRole('button', { name: 'Editar peso' })).toHaveLength(2)
  })
})
