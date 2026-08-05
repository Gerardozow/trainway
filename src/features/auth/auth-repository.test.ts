import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()
const signOutMock = vi.fn()
const setSession = vi.fn()
const signUpMock = vi.fn()
const setUsernameMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuth(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
      setSession: (...args: unknown[]) => setSession(...args),
      signUp: (...args: unknown[]) => signUpMock(...args),
    },
  },
}))

vi.mock('../profile/profile-repository', async (importOriginal) => {
  // validateUsername es lógica pura y se quiere la real: si la simulamos,
  // las pruebas de username inválido dejarían de probar nada.
  const actual = await importOriginal<typeof import('../profile/profile-repository')>()
  return { ...actual, setUsername: (...args: unknown[]) => setUsernameMock(...args) }
})

vi.stubGlobal('fetch', fetchMock)

const {
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signInWithIdentifier,
  signUpWithPassword,
} = await import('./auth-repository')

beforeEach(() => {
  signInWithOtp.mockReset()
  signInWithOAuth.mockReset()
  signOutMock.mockReset()
  setSession.mockReset()
  signUpMock.mockReset()
  setUsernameMock.mockReset()
  fetchMock.mockReset()
  setSession.mockResolvedValue({ error: null })
})

describe('auth-repository', () => {
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

describe('signInWithIdentifier', () => {
  it('rechaza identificador vacío sin llamar a la red', async () => {
    const result = await signInWithIdentifier('', 'contrasena12')
    expect(result.error).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza contraseña vacía sin llamar a la red', async () => {
    const result = await signInWithIdentifier('gerardo_99', '')
    expect(result.error).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('guarda la sesión que devuelve la función', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ session: { access_token: 'a', refresh_token: 'b' } }),
    })
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBeNull()
    expect(setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'b' })
  })

  it('traduce el rechazo de la función a un mensaje único', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Credenciales inválidas' }),
    })
    const result = await signInWithIdentifier('gerardo_99', 'mala')
    expect(result.error).toBe('Credenciales inválidas')
    expect(setSession).not.toHaveBeenCalled()
  })

  it('traduce un fallo de red a un mensaje legible', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBe('No se pudo conectar. Revisa tu conexión.')
  })

  // La Edge Function distingue 503 (el servicio falló) de 400 (credenciales
  // rechazadas) precisamente para no decirle a alguien que su contraseña
  // está mal cuando el problema es nuestro. El repositorio no puede colapsar
  // esa distinción de vuelta a un solo mensaje.
  it('traduce un fallo de servicio (503) a un mensaje distinto del de credenciales', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Servicio no disponible' }),
    })
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBe('Servicio no disponible')
    expect(result.error).not.toBe('Credenciales inválidas')
    expect(setSession).not.toHaveBeenCalled()
  })
})

describe('signUpWithPassword', () => {
  it('rechaza una contraseña de menos de 8 caracteres sin llamar a la red', async () => {
    const result = await signUpWithPassword('a@b.com', 'corta12', 'gerardo_99')
    expect(result.error).toMatch(/8/)
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('rechaza un username inválido sin llamar a la red', async () => {
    const result = await signUpWithPassword('a@b.com', 'contrasena12', 'MAYUS')
    expect(result.error).not.toBeNull()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('rechaza un correo inválido sin llamar a la red', async () => {
    const result = await signUpWithPassword('no-es-correo', 'contrasena12', 'gerardo_99')
    expect(result.error).not.toBeNull()
    expect(signUpMock).not.toHaveBeenCalled()
  })
})
