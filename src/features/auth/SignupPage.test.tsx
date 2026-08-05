import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const signUpWithPassword = vi.fn()
vi.mock('./auth-repository', () => ({
  signUpWithPassword: (...args: unknown[]) => signUpWithPassword(...args),
}))

const { SignupPage } = await import('./SignupPage')

describe('SignupPage', () => {
  beforeEach(() => {
    signUpWithPassword.mockReset()
  })

  it('envía correo, contraseña y username', async () => {
    signUpWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(signUpWithPassword).toHaveBeenCalledWith(
      'gerardo@tradeway.mx',
      'contrasena12',
      'gerardo_99',
    )
  })

  it('muestra el error que devuelve el repositorio', async () => {
    signUpWithPassword.mockResolvedValue({ error: 'Ese username ya está tomado' })
    const user = userEvent.setup()
    render(<SignupPage />)

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese username ya está tomado',
    )
  })

  it('pasa el username a minúsculas mientras se escribe', async () => {
    const user = userEvent.setup()
    render(<SignupPage />)

    const field = screen.getByLabelText(/usuario/i)
    await user.type(field, 'Gerardo')
    expect(field).toHaveValue('gerardo')
  })
})
