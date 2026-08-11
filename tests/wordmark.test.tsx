import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Wordmark } from '@/components/Wordmark'

describe('Wordmark', () => {
  it('se anuncia una sola vez', () => {
    render(
      <h1>
        <Wordmark />
      </h1>,
    )
    // Partido en dos trozos de color y con un texto alternativo al lado, esto
    // llegó a leerse "TRAINWAYTrainway".
    expect(screen.getByRole('heading')).toHaveAccessibleName('Trainway')
  })

  it('el dibujo sigue estando para quien lo ve', () => {
    render(<Wordmark />)
    expect(screen.getByText('TRAIN')).toBeInTheDocument()
    expect(screen.getByText('WAY')).toBeInTheDocument()
  })
})
