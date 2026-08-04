import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Session } from '@supabase/supabase-js'

const useAuthMock = vi.fn()

vi.mock('../features/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

const { routes } = await import('./routes')

const fakeSession = { access_token: 'token' } as unknown as Session

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('routes', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it.each(['/', '/rutinas', '/progreso', '/perfil'])(
    'protege %s con RequireAuth: sin sesión redirige a login en vez de mostrar la pantalla',
    (path) => {
      useAuthMock.mockReturnValue({ session: null, loading: false })
      renderAt(path)

      expect(screen.getByText('Correo')).toBeInTheDocument()
    },
  )

  it('deja pasar las cuatro rutas cuando hay sesión', () => {
    useAuthMock.mockReturnValue({ session: fakeSession, loading: false })
    renderAt('/rutinas')

    expect(screen.getByRole('heading', { name: 'Rutinas' })).toBeInTheDocument()
    expect(screen.queryByText('Correo')).not.toBeInTheDocument()
  })

  it('redirige cualquier ruta desconocida a la raíz en vez de mostrar el error boundary por defecto', () => {
    useAuthMock.mockReturnValue({ session: fakeSession, loading: false })
    renderAt('/esto-no-existe/ni-esto')

    expect(screen.getByRole('heading', { name: 'Entrenar' })).toBeInTheDocument()
  })

  it('define un errorElement en la ruta raíz para no dejar al usuario sin salida', () => {
    const root = routes.find((route) => route.path === '/')
    expect(root?.errorElement).toBeTruthy()
  })
})
