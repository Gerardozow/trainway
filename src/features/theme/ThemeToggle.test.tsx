import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('aplica la clase dark al elegir el tema oscuro', async () => {
    const user = userEvent.setup()
    renderToggle()
    await user.click(screen.getByRole('button', { name: /oscuro/i }))
    expect(document.documentElement).toHaveClass('dark')
  })

  it('quita la clase dark al volver al tema claro', async () => {
    const user = userEvent.setup()
    renderToggle()
    await user.click(screen.getByRole('button', { name: /oscuro/i }))
    await user.click(screen.getByRole('button', { name: /claro/i }))
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('persiste la elección entre montajes', async () => {
    const user = userEvent.setup()
    const { unmount } = renderToggle()
    await user.click(screen.getByRole('button', { name: /oscuro/i }))
    unmount()
    renderToggle()
    expect(document.documentElement).toHaveClass('dark')
  })
})
