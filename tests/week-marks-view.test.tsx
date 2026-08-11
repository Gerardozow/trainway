import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeekMarks } from '@/components/WeekMarks'
import type { WeekMark } from '@/lib/history'

/**
 * Las siete marcas son un dibujo: lleno, hueco, punteado. Sin texto alternativo
 * no dicen nada a quien no las ve, y ahí se pierde toda la pantalla.
 */

const mark = (over: Partial<WeekMark>): WeekMark => ({
  dayIndex: 1,
  initial: 'L',
  planned: false,
  done: false,
  today: false,
  missed: false,
  title: null,
  ...over,
})

describe('WeekMarks', () => {
  it('resume la semana en una sola frase', () => {
    render(
      <WeekMarks
        marks={[
          mark({ dayIndex: 1, initial: 'L', planned: true, done: true, title: 'Empuje' }),
          mark({ dayIndex: 2, initial: 'M' }),
          mark({ dayIndex: 3, initial: 'X', planned: true, title: 'Jalón' }),
        ]}
      />,
    )

    expect(screen.getByRole('list', { name: 'Semana: 1 de 2 entrenamientos hechos' })).toBeVisible()
  })

  it('cada marca dice qué es sin depender del color', () => {
    render(
      <WeekMarks
        marks={[
          mark({ dayIndex: 1, initial: 'L', planned: true, done: true, title: 'Empuje' }),
          mark({ dayIndex: 2, initial: 'M' }),
          mark({ dayIndex: 3, initial: 'X', planned: true, missed: true, title: 'Jalón' }),
          mark({ dayIndex: 5, initial: 'V', planned: true, title: 'Pierna' }),
        ]}
      />,
    )

    expect(screen.getByText('Empuje: hecho')).toBeInTheDocument()
    expect(screen.getByText('Jalón: sin hacer')).toBeInTheDocument()
    expect(screen.getByText('Pierna: pendiente')).toBeInTheDocument()
    expect(screen.getByText('descanso')).toBeInTheDocument()
  })
})
