import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppShell } from './AppShell'

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

describe('AppShell', () => {
  it('muestra los cuatro destinos', () => {
    renderShell()
    expect(screen.getByRole('link', { name: 'Entrenar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rutinas' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Progreso' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Perfil' })).toBeInTheDocument()
  })

  it('marca el destino activo para lectores de pantalla', () => {
    renderShell('/rutinas')
    expect(screen.getByRole('link', { name: 'Rutinas' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Entrenar' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('resalta el destino activo con un fondo, no solo con color de texto', () => {
    renderShell('/rutinas')

    // La pastilla vive en un elemento interior, no en el enlace: lo que
    // importa es que el activo tenga una forma que lo distinga y el inactivo
    // no, para no depender solo de poder ver el color.
    const activo = screen.getByRole('link', { name: 'Rutinas' })
    const inactivo = screen.getByRole('link', { name: 'Entrenar' })

    expect(activo.querySelector('.bg-brand')).not.toBeNull()
    expect(inactivo.querySelector('.bg-brand')).toBeNull()
  })

  it('cada destino lleva un icono además del texto', () => {
    renderShell('/')

    for (const label of ['Entrenar', 'Rutinas', 'Progreso', 'Perfil']) {
      const enlace = screen.getByRole('link', { name: label })
      expect(enlace.querySelector('svg')).not.toBeNull()
    }
  })
})
