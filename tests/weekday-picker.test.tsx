import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { WeekdayPicker } from '@/components/WeekdayPicker'

function Harness({ initial = [] as number[], onChange = (_: number[]) => {} }) {
  const [days, setDays] = useState(initial)
  return (
    <WeekdayPicker
      value={days}
      onChange={(d) => {
        setDays(d)
        onChange(d)
      }}
    />
  )
}

describe('WeekdayPicker', () => {
  it('enseña los siete días con su nombre completo', () => {
    render(<Harness />)
    for (const d of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(screen.getByRole('button', { name: d })).toBeInTheDocument()
    }
  })

  it('marcar y desmarcar devuelve los días ordenados', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Viernes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Lunes' }))
    expect(onChange).toHaveBeenLastCalledWith([1, 5])
    await userEvent.click(screen.getByRole('button', { name: 'Viernes' }))
    expect(onChange).toHaveBeenLastCalledWith([1])
  })

  it('marca los elegidos como pulsados', () => {
    render(<Harness initial={[3]} />)
    expect(screen.getByRole('button', { name: 'Miércoles' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Jueves' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('dice cuántos días lleva elegidos', () => {
    render(<Harness initial={[1, 3, 5]} />)
    expect(screen.getByText('3 días por semana')).toBeInTheDocument()
  })
})
