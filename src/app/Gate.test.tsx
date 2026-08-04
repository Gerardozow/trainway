import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'

const useAuthMock = vi.fn()
const fetchProfileMock = vi.fn()

vi.mock('../features/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('../features/profile/profile-repository', () => ({
  fetchProfile: (...args: unknown[]) => fetchProfileMock(...args),
}))

vi.mock('../features/profile/UsernameOnboarding', () => ({
  UsernameOnboarding: () => <p>Onboarding stub</p>,
}))

const { Gate } = await import('./Gate')

const fakeSession = { user: { id: 'user-1' } } as unknown as Session

describe('Gate', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    fetchProfileMock.mockReset()
  })

  it('muestra el onboarding cuando la sesión no tiene username todavía', async () => {
    useAuthMock.mockReturnValue({ session: fakeSession, loading: false })
    fetchProfileMock.mockResolvedValue({
      id: 'user-1',
      username: null,
      display_name: null,
      avatar_url: null,
    })

    render(<Gate />)

    expect(await screen.findByText('Onboarding stub')).toBeInTheDocument()
  })

  it('muestra el router cuando la sesión ya tiene username', async () => {
    useAuthMock.mockReturnValue({ session: fakeSession, loading: false })
    fetchProfileMock.mockResolvedValue({
      id: 'user-1',
      username: 'gerardo',
      display_name: null,
      avatar_url: null,
    })

    render(<Gate />)

    expect(await screen.findByRole('heading', { name: 'Entrenar' })).toBeInTheDocument()
    expect(screen.queryByText('Onboarding stub')).not.toBeInTheDocument()
  })
})
