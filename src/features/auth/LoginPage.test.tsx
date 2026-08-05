import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

const signInWithIdentifier = vi.fn()
const signInWithEmail = vi.fn()

// signInWithGoogle no se simula aquí a propósito: LoginPage ya no lo importa.
// El proveedor de Google sigue sin credenciales configuradas (ver
// auth-repository.ts), así que el botón se retiró de esta pantalla; la
// función se conserva exportada y probada en auth-repository.test.ts para
// cuando el producto lo reactive.
vi.mock('./auth-repository', () => ({
  signInWithIdentifier: (...a: unknown[]) => signInWithIdentifier(...a),
  signInWithEmail: (...a: unknown[]) => signInWithEmail(...a),
}))

const { LoginPage } = await import('./LoginPage')

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithIdentifier.mockReset()
    signInWithEmail.mockReset()
  })

  it('entra con identificador y contraseña', async () => {
    signInWithIdentifier.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/usuario o correo/i), 'gerardo_99')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(signInWithIdentifier).toHaveBeenCalledWith('gerardo_99', 'contrasena12')
  })

  it('anuncia el error de credenciales', async () => {
    signInWithIdentifier.mockResolvedValue({ error: 'Credenciales inválidas' })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/usuario o correo/i), 'gerardo_99')
    await user.type(screen.getByLabelText(/contraseña/i), 'mala')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas')
  })

  it('ofrece el magic link como segunda opción', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /enlace por correo/i }))
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument()
  })
})
