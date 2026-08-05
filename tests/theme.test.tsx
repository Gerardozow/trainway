import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useTheme } from '@/lib/theme'

function Probe() {
  const { theme, resolved, setTheme } = useTheme()
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setTheme('dark')}>oscuro</button>
      <button onClick={() => setTheme('light')}>claro</button>
    </>
  )
}

const renderProbe = () =>
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )

describe('tema', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('arranca en system cuando no hay nada guardado', () => {
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })

  it('al elegir oscuro aplica la clase dark y persiste', async () => {
    renderProbe()
    await userEvent.click(screen.getByText('oscuro'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('trainway-theme')).toBe('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
  })

  it('al elegir claro quita la clase dark', async () => {
    renderProbe()
    await userEvent.click(screen.getByText('oscuro'))
    await userEvent.click(screen.getByText('claro'))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByTestId('resolved')).toHaveTextContent('light')
  })

  it('lee el tema guardado al montar', () => {
    localStorage.setItem('trainway-theme', 'dark')
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('ignora un valor guardado corrupto y cae en system', () => {
    localStorage.setItem('trainway-theme', 'neón')
    renderProbe()
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })
})
