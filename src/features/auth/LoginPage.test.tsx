import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router'

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

  // "Credenciales inválidas" es el mismo mensaje para cualquier fallo de
  // credenciales, incluida una cuenta real sin confirmar (config.toml tiene
  // enable_confirmations = true y no hay SMTP configurado por defecto: ver
  // README.md). Sin este mensaje, esa cuenta queda indistinguible de una
  // contraseña mal escrita para quien la creó, sin pista de qué hacer. La
  // pista no depende del identificador -- se muestra ante CUALQUIER fallo de
  // credenciales -- así que no delata si la cuenta existe ni si está
  // confirmada.
  it('muestra una pista sobre confirmar el correo junto al error de credenciales', async () => {
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

    await screen.findByRole('alert')
    expect(
      screen.getByText(/confirma tu correo antes de entrar/i),
    ).toBeInTheDocument()
  })

  it('no muestra la pista de confirmación de correo antes de intentar entrar', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(
      screen.queryByText(/confirma tu correo antes de entrar/i),
    ).not.toBeInTheDocument()
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

  // A diferencia del magic link y de Google, que vuelven a la app por una
  // URL de redirección, el login por contraseña nunca sale de /login. Sin
  // una navegación explícita tras el éxito, la sesión queda válida pero
  // quien entró se queda viendo el mismo formulario. Se comprueba con un
  // router real (no un MemoryRouter suelto) para que la aserción falle si
  // esa navegación desaparece.
  it('navega a / tras un inicio de sesión exitoso', async () => {
    signInWithIdentifier.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    const router = createMemoryRouter(
      [
        { path: '/login', element: <LoginPage /> },
        { path: '/', element: <div>Pantalla de inicio</div> },
      ],
      { initialEntries: ['/login'] },
    )
    render(<RouterProvider router={router} />)

    await user.type(screen.getByLabelText(/usuario o correo/i), 'gerardo_99')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument()
  })
})
