import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import type { Session } from '@supabase/supabase-js'

const useAuthMock = vi.fn()

vi.mock('./useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const { RequireAuth } = await import('./RequireAuth')

const fakeSession = { access_token: 'token' } as unknown as Session

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <p>Protected content</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('muestra el estado de carga y no renderiza los children mientras loading es true', () => {
    useAuthMock.mockReturnValue({ session: null, loading: true })
    renderProtectedRoute()

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('redirige a /login cuando terminó de cargar y no hay sesión', () => {
    useAuthMock.mockReturnValue({ session: null, loading: false })
    renderProtectedRoute()

    expect(screen.getByText('Login screen')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renderiza los children cuando hay sesión', () => {
    useAuthMock.mockReturnValue({ session: fakeSession, loading: false })
    renderProtectedRoute()

    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })
})
