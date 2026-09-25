import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExerciseImage } from '@/components/ExerciseImage'

const IMAGES: [string, string] = ['Leg_Press/0.jpg', 'Leg_Press/1.jpg']

describe('ExerciseImage', () => {
  it('la miniatura sigue enseñando solo la posición inicial', () => {
    render(<ExerciseImage images={IMAGES} alt="Prensa" />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('la variante pair enseña las dos posiciones lado a lado', () => {
    render(<ExerciseImage images={IMAGES} alt="Prensa" variant="pair" />)
    expect(screen.getByAltText('Prensa, posición inicial')).toBeInTheDocument()
    expect(screen.getByAltText('Prensa, posición final')).toBeInTheDocument()
    expect(screen.getByText('Inicio')).toBeInTheDocument()
    expect(screen.getByText('Fin')).toBeInTheDocument()
  })

  it('tocar el par abre el diálogo a pantalla completa', async () => {
    render(<ExerciseImage images={IMAGES} alt="Prensa" variant="pair" />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver Prensa en grande' }))
    expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('open')
  })

  it('si una foto del par falla, esa muestra el recuadro y la otra sigue', () => {
    render(<ExerciseImage images={IMAGES} alt="Prensa" variant="pair" />)
    fireEvent.error(screen.getByAltText('Prensa, posición inicial'))
    expect(screen.queryByAltText('Prensa, posición inicial')).not.toBeInTheDocument()
    expect(screen.getByAltText('Prensa, posición final')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver Prensa en grande' })).toBeInTheDocument()
  })

  it('si fallan las dos no se ofrece ampliar', () => {
    render(<ExerciseImage images={IMAGES} alt="Prensa" variant="pair" />)
    fireEvent.error(screen.getByAltText('Prensa, posición inicial'))
    fireEvent.error(screen.getByAltText('Prensa, posición final'))
    expect(screen.queryByRole('button', { name: 'Ver Prensa en grande' })).not.toBeInTheDocument()
  })

  // En la PWA de iPhone la barra de estado es translúcida y la página pasa por
  // debajo: sin este margen, el botón de cerrar quedaba tapado y no se podía salir.
  it('el botón de cerrar queda por debajo de la barra de estado', async () => {
    render(<ExerciseImage images={IMAGES} alt="Prensa" variant="pair" />)
    await userEvent.click(screen.getByRole('button', { name: 'Ver Prensa en grande' }))
    const cerrar = screen.getByRole('button', { name: 'Cerrar', hidden: true })
    expect(cerrar.parentElement!.className).toMatch(/safe-area-inset-top/)
  })
})
