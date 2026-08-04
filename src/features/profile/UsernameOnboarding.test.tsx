import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const setUsernameMock = vi.fn()

vi.mock('./profile-repository', async () => {
  const actual =
    await vi.importActual<typeof import('./profile-repository')>('./profile-repository')
  return {
    ...actual,
    setUsername: (...args: unknown[]) => setUsernameMock(...args),
  }
})

const { UsernameOnboarding } = await import('./UsernameOnboarding')

describe('UsernameOnboarding', () => {
  beforeEach(() => {
    setUsernameMock.mockReset()
  })

  it('recorta espacios al final antes de validar y guardar', async () => {
    setUsernameMock.mockResolvedValue({ error: null })
    const onDone = vi.fn()
    const user = userEvent.setup()

    render(<UsernameOnboarding userId="user-1" onDone={onDone} />)

    await user.type(screen.getByLabelText('Username'), 'gerardo_99 ')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(setUsernameMock).toHaveBeenCalledWith('user-1', 'gerardo_99')
    expect(screen.queryByText(/Solo minúsculas/)).not.toBeInTheDocument()
    expect(onDone).toHaveBeenCalledOnce()
  })
})
