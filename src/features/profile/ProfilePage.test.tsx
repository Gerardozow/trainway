import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { ThemeProvider } from '../theme/ThemeProvider'

const setUsernameMock = vi.fn()
const fetchProfileMock = vi.fn()

vi.mock('./profile-repository', async (importOriginal) => {
  // validateUsername es lógica pura y se quiere la real: si se simulara, la
  // prueba de formato inválido dejaría de probar nada.
  const actual = await importOriginal<typeof import('./profile-repository')>()
  return {
    ...actual,
    setUsername: (...args: unknown[]) => setUsernameMock(...args),
    fetchProfile: (...args: unknown[]) => fetchProfileMock(...args),
  }
})

const signOutMock = vi.fn()
vi.mock('../auth/auth-repository', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

const useAuthMock = vi.fn()
vi.mock('../auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const { ProfilePage } = await import('./ProfilePage')

const fakeSession = { user: { id: 'user-1' } } as unknown as Session

// ProfilePage incluye ThemeToggle, que exige un ThemeProvider por encima.
function renderProfilePage() {
  return render(
    <ThemeProvider>
      <ProfilePage />
    </ThemeProvider>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    setUsernameMock.mockReset()
    fetchProfileMock.mockReset()
    signOutMock.mockReset()
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ session: fakeSession, loading: false })
    fetchProfileMock.mockResolvedValue({
      id: 'user-1',
      username: 'viejo_nombre',
      display_name: null,
      avatar_url: null,
    })
  })

  it('cambia el username con éxito', async () => {
    setUsernameMock.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    renderProfilePage()

    await user.type(screen.getByLabelText(/cambiar usuario/i), 'nuevo_nombre')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    expect(await screen.findByText(/actualizado/i)).toBeInTheDocument()
    expect(setUsernameMock).toHaveBeenCalledWith('user-1', 'nuevo_nombre')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('muestra el mensaje de colisión cuando el username ya está tomado', async () => {
    setUsernameMock.mockResolvedValue({ error: 'Ese username ya está tomado' })
    const user = userEvent.setup()
    renderProfilePage()

    await user.type(screen.getByLabelText(/cambiar usuario/i), 'tomado_ya')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Ese username ya está tomado')
    expect(alert).toHaveClass('text-danger')
  })

  it('rechaza un formato inválido sin llamar a la red', async () => {
    const user = userEvent.setup()
    renderProfilePage()

    await user.type(screen.getByLabelText(/cambiar usuario/i), 'ab')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/3 caracteres/)
    expect(setUsernameMock).not.toHaveBeenCalled()
  })
})
