import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

const getSession = vi.fn()
const onAuthStateChange = vi.fn()
const unsubscribe = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChange(...args),
    },
  },
}))

const { AuthProvider } = await import('./AuthProvider')
const { useAuth } = await import('./useAuth')

const fakeSession = { access_token: 'token-abc', user: { id: 'user-1' } } as unknown as Session

function Consumer() {
  const { session, loading } = useAuth()
  return (
    <p>
      loading:{String(loading)} session:{session ? session.access_token : 'null'}
    </p>
  )
}

describe('AuthProvider', () => {
  let stateChangeCallback: ((event: string, session: Session | null) => void) | undefined

  beforeEach(() => {
    getSession.mockReset()
    onAuthStateChange.mockReset()
    unsubscribe.mockReset()
    stateChangeCallback = undefined
    getSession.mockResolvedValue({ data: { session: null } })
    onAuthStateChange.mockImplementation((callback) => {
      stateChangeCallback = callback
      return { data: { subscription: { unsubscribe } } }
    })
  })

  it('se da de baja de onAuthStateChange al desmontarse', async () => {
    const { unmount } = render(
      <AuthProvider>
        <p>child</p>
      </AuthProvider>,
    )

    // deja que se resuelva la promesa de getSession() dentro del efecto
    await Promise.resolve()

    expect(unsubscribe).not.toHaveBeenCalled()

    unmount()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('llena la sesión con el resultado de getSession', async () => {
    getSession.mockResolvedValue({ data: { session: fakeSession } })

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )

    expect(await screen.findByText('loading:false session:token-abc')).toBeInTheDocument()
  })

  it('actualiza la sesión cuando el callback de onAuthStateChange se dispara', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )

    expect(await screen.findByText('loading:false session:null')).toBeInTheDocument()

    act(() => {
      stateChangeCallback?.('SIGNED_IN', fakeSession)
    })

    expect(await screen.findByText('loading:false session:token-abc')).toBeInTheDocument()
  })

  it('resuelve loading a false incluso si getSession es rechazada', async () => {
    getSession.mockRejectedValue(new Error('boom'))

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    )

    expect(await screen.findByText('loading:false session:null')).toBeInTheDocument()
  })
})
