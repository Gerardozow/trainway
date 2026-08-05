import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

const state: { user: unknown; loading: boolean } = { user: null, loading: false }

vi.mock('@/lib/supabase/useAuth', () => ({
  useAuth: () => ({
    user: state.user,
    session: null,
    loading: state.loading,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { RequireAuth } = await import('@/components/RequireAuth')

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/entrar" element={<p>pantalla de entrada</p>} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <p>contenido protegido</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    state.user = null
    state.loading = false
  })

  it('sin sesión manda a la pantalla de entrada', () => {
    renderAt('/')
    expect(screen.getByText('pantalla de entrada')).toBeInTheDocument()
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
  })

  it('con sesión muestra el contenido', () => {
    state.user = { id: 'u1' }
    renderAt('/')
    expect(screen.getByText('contenido protegido')).toBeInTheDocument()
  })

  it('mientras carga no decide nada todavía', () => {
    state.loading = true
    renderAt('/')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('pantalla de entrada')).not.toBeInTheDocument()
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument()
  })
})
