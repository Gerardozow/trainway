import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ExercisePreview } from '@/components/ExercisePreview'
import type { ExerciseTranslation, ProgramExercise } from '@/lib/supabase/types'

const ex = (overrides: Partial<ProgramExercise> = {}): ProgramExercise => ({
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
  ...overrides,
})

const translation: ExerciseTranslation = {
  exercise_id: 'Leg_Press',
  locale: 'es',
  name: 'Prensa de piernas',
  instructions: ['Siéntate en la máquina.', 'Empuja con los talones.'],
}

const renderPreview = (props: Parameters<typeof ExercisePreview>[0]) =>
  render(
    <MemoryRouter>
      <ExercisePreview {...props} />
    </MemoryRouter>,
  )

describe('ExercisePreview', () => {
  it('enseña nombre traducido, dosis con descanso y las dos fotos', () => {
    renderPreview({ exercise: ex(), translation })
    expect(screen.getByRole('heading', { name: 'Prensa de piernas' })).toBeInTheDocument()
    expect(screen.getByText('3 × 10-12 · 90 s')).toBeInTheDocument()
    expect(screen.getByAltText('Prensa de piernas, posición inicial')).toBeInTheDocument()
    expect(screen.getByAltText('Prensa de piernas, posición final')).toBeInTheDocument()
  })

  it('sin traducción cae al nombre del catálogo', () => {
    renderPreview({ exercise: ex() })
    expect(screen.getByRole('heading', { name: 'Leg Press' })).toBeInTheDocument()
  })

  it('el cardio va en minutos y sin fotos', () => {
    renderPreview({
      exercise: ex({
        exercise_id: 'Stairmaster',
        category: 'cardio',
        target_duration_seconds: 900,
        rest_seconds: 0,
      }),
    })
    expect(screen.getByText('15 min')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('Cardio')).toBeInTheDocument()
  })

  it('enseña la nota del coach', () => {
    renderPreview({ exercise: ex({ coach_note: 'Baja hasta 90 grados.' }), translation })
    expect(screen.getByText('Baja hasta 90 grados.')).toBeInTheDocument()
  })

  it('"Cómo se hace" despliega los pasos', async () => {
    renderPreview({ exercise: ex(), translation })
    expect(screen.queryByText('Empuja con los talones.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /cómo se hace/i }))
    expect(screen.getByText('Empuja con los talones.')).toBeInTheDocument()
  })

  it('con href, el nombre entra al entreno', () => {
    renderPreview({ exercise: ex(), translation, href: '/sesion/pd1' })
    expect(screen.getByRole('link', { name: /prensa de piernas/i })).toHaveAttribute(
      'href',
      '/sesion/pd1',
    )
  })

  it('sin href no hay enlace', () => {
    renderPreview({ exercise: ex(), translation })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  // Dentro de una rejilla con <li className="flex">, sin esto la tarjeta se
  // encogía al ancho del texto y las fotos quedaban diminutas.
  it('ocupa todo el ancho que le den', () => {
    renderPreview({ exercise: ex(), translation })
    expect(screen.getByRole('article')).toHaveClass('w-full')
  })

  it('un id que ya no está en el catálogo no pinta nada', () => {
    const { container } = renderPreview({ exercise: ex({ exercise_id: 'No_Existe' }) })
    expect(container).toBeEmptyDOMElement()
  })
})
