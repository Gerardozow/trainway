import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

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

describe('AuthProvider', () => {
  beforeEach(() => {
    getSession.mockReset()
    onAuthStateChange.mockReset()
    unsubscribe.mockReset()
    getSession.mockResolvedValue({ data: { session: null } })
    onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
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
})
