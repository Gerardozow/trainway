import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

const signUpWithPassword = vi.fn()
vi.mock('./auth-repository', () => ({
  signUpWithPassword: (...args: unknown[]) => signUpWithPassword(...args),
}))

const isUsernameAvailable = vi.fn()
vi.mock('../profile/profile-repository', async (importOriginal) => {
  // validateUsername es lógica pura y se quiere la real: si se simulara,
  // las pruebas de formato inválido dejarían de probar nada.
  const actual = await importOriginal<typeof import('../profile/profile-repository')>()
  return {
    ...actual,
    isUsernameAvailable: (...args: unknown[]) => isUsernameAvailable(...args),
  }
})

const { SignupPage } = await import('./SignupPage')

function renderSignupPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  )
}

describe('SignupPage', () => {
  beforeEach(() => {
    signUpWithPassword.mockReset()
    isUsernameAvailable.mockReset()
    isUsernameAvailable.mockResolvedValue(true)
  })

  it('envía correo, contraseña y username', async () => {
    signUpWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderSignupPage()

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
    renderSignupPage()

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese username ya está tomado',
    )
  })

  // Sin recortar aquí, un espacio al final pasa validateUsername (que sí
  // recorta) pero llegaría crudo tanto a isUsernameAvailable como a
  // signUpWithPassword -- el username en la base termina recortado (ver
  // auth-repository.ts), así que el chequeo previo consultaría un nombre
  // distinto del que en realidad se va a guardar.
  it('recorta espacios del username antes de comprobar disponibilidad y enviar', async () => {
    isUsernameAvailable.mockResolvedValue(true)
    signUpWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99 ')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText(/cuenta creada/i)).toBeInTheDocument()
    expect(isUsernameAvailable).toHaveBeenCalledWith('gerardo_99')
    expect(signUpWithPassword).toHaveBeenCalledWith(
      'gerardo@tradeway.mx',
      'contrasena12',
      'gerardo_99',
    )
  })

  it('pasa el username a minúsculas mientras se escribe', async () => {
    const user = userEvent.setup()
    renderSignupPage()

    const field = screen.getByLabelText(/usuario/i)
    await user.type(field, 'Gerardo')
    expect(field).toHaveValue('gerardo')
  })

  // La pantalla de éxito es terminal en una PWA instalada: sin barra de
  // direcciones ni nav (las rutas públicas quedan fuera de AppShell), un
  // callejón sin salida ahí deja a quien se acaba de registrar sin forma de
  // llegar a /login salvo forzar el cierre de la app.
  it('ofrece un camino a /login desde la pantalla de éxito', async () => {
    signUpWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    const link = await screen.findByRole('link', { name: /iniciar sesión/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  // La comprobación previa no cierra la carrera (el trigger la cubre), pero
  // convierte el caso común —nombre ya tomado— en un mensaje claro en vez de
  // dejar que el alta siga y el perfil nazca sin username.
  it('rechaza un username tomado antes de crear la cuenta', async () => {
    isUsernameAvailable.mockResolvedValue(false)
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese username ya está tomado',
    )
    expect(signUpWithPassword).not.toHaveBeenCalled()
  })

  it('crea la cuenta cuando el username está libre', async () => {
    isUsernameAvailable.mockResolvedValue(true)
    signUpWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText(/cuenta creada/i)).toBeInTheDocument()
    expect(signUpWithPassword).toHaveBeenCalledWith(
      'gerardo@tradeway.mx',
      'contrasena12',
      'gerardo_99',
    )
  })

  it('rechaza un username con formato inválido sin consultar disponibilidad', async () => {
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'ab')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(isUsernameAvailable).not.toHaveBeenCalled()
    expect(signUpWithPassword).not.toHaveBeenCalled()
  })

  // Un RPC caído (sin red, PGRST202 por caché de esquema sin recargar, etc.)
  // no debe bloquear el alta: isUsernameAvailable devuelve null en ese caso,
  // y la pantalla lo trata como vía libre en vez de fallar cerrado. El
  // trigger handle_new_user es la garantía real de que la cuenta no se
  // pierde, no este pre-chequeo.
  it('sigue el alta cuando la comprobación de disponibilidad falla', async () => {
    isUsernameAvailable.mockResolvedValue(null)
    signUpWithPassword.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderSignupPage()

    await user.type(screen.getByLabelText(/correo/i), 'gerardo@tradeway.mx')
    await user.type(screen.getByLabelText(/contraseña/i), 'contrasena12')
    await user.type(screen.getByLabelText(/usuario/i), 'gerardo_99')
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }))

    expect(await screen.findByText(/cuenta creada/i)).toBeInTheDocument()
    expect(signUpWithPassword).toHaveBeenCalledWith(
      'gerardo@tradeway.mx',
      'contrasena12',
      'gerardo_99',
    )
  })
})
