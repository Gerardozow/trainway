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
})
