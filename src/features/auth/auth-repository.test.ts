import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()
const signOutMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
  },
}))

const { signInWithEmail, signInWithGoogle, signOut } = await import('./auth-repository')

describe('auth-repository', () => {
  beforeEach(() => {
    signInWithOtp.mockReset()
    signInWithOAuth.mockReset()
    signOutMock.mockReset()
  })

  it('devuelve error sin llamar al servidor cuando el correo es inválido', async () => {
    const result = await signInWithEmail('no-es-correo')
    expect(result.error).not.toBeNull()
    expect(signInWithOtp).not.toHaveBeenCalled()
  })

  it('envía el magic link con un correo válido', async () => {
    signInWithOtp.mockResolvedValue({ error: null })
    const result = await signInWithEmail('gerardo@tradeway.mx')
    expect(result.error).toBeNull()
    expect(signInWithOtp).toHaveBeenCalledOnce()
  })

  it('traduce el fallo del servidor a un mensaje legible', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'rate limit exceeded' } })
    const result = await signInWithEmail('gerardo@tradeway.mx')
    expect(result.error).toBe('No se pudo enviar el correo. Inténtalo en un minuto.')
  })

  it('pide a Supabase el flujo de Google', async () => {
    signInWithOAuth.mockResolvedValue({ error: null })
    await signInWithGoogle()
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }),
    )
  })

  it('cierra sesión', async () => {
    signOutMock.mockResolvedValue({ error: null })
    await signOut()
    expect(signOutMock).toHaveBeenCalledOnce()
  })
})
