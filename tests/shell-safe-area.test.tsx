import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

vi.mock('@/components/UpdateBanner', () => ({ AppUpdatePrompt: () => null }))
vi.mock('@/components/BottomNav', () => ({ BottomNav: () => null }))

const { Shell } = await import('@/App')

// La PWA de iPhone pinta la página debajo de una barra de estado translúcida
// (black-translucent + viewport-fit=cover). Todo lo de arriba —títulos,
// botones— quedaba tapado.
describe('Shell y la barra de estado', () => {
  it('baja el contenido lo que mide la barra de estado', () => {
    const { container } = render(
      <MemoryRouter>
        <Shell>
          <p>contenido</p>
        </Shell>
      </MemoryRouter>,
    )
    expect((container.firstChild as HTMLElement).className).toMatch(
      /pt-\[env\(safe-area-inset-top\)\]/,
    )
  })

  it('tapa con el fondo lo que pasa por debajo de la barra al hacer scroll', () => {
    render(
      <MemoryRouter>
        <Shell>
          <p>contenido</p>
        </Shell>
      </MemoryRouter>,
    )
    const franja = document.querySelector('[data-status-bar]') as HTMLElement
    expect(franja).not.toBeNull()
    expect(franja.className).toMatch(/fixed/)
    expect(franja.className).toMatch(/h-\[env\(safe-area-inset-top\)\]/)
  })
})
