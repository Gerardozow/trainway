import { describe, it, expect, vi, beforeEach } from 'vitest'

const signInWithOtp = vi.fn()
const signInWithOAuth = vi.fn()
const signOutMock = vi.fn()
const setSession = vi.fn()
const signUpMock = vi.fn()
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

// validateUsername (la única función de profile-repository que sigue
// importando auth-repository) es lógica pura; no hace falta simularla.

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

  // Solo el 400 de la función es un veredicto de credenciales. El navegador
  // también puede recibir respuestas del gateway de Functions, que no es la
  // función: 404 si no está desplegada, 401 por una anon key mal
  // configurada, 502/504 si el runtime no arrancó. Ninguna de esas debe
  // leerse como "contraseña incorrecta".
  it('trata un estado inesperado (404) como fallo de servicio, no de credenciales', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Function not found' }),
    })
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBe('Function not found')
    expect(result.error).not.toBe('Credenciales inválidas')
  })

  it('trata un cuerpo no-JSON del gateway como fallo de servicio, no como problema de red', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBe('Servicio no disponible, intenta de nuevo')
    expect(result.error).not.toBe('No se pudo conectar. Revisa tu conexión.')
  })

  it('no revienta ni delata credenciales cuando el error del cuerpo no es texto', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { unexpected: 'shape' } }),
    })
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
    expect(result.error).toBe('Servicio no disponible, intenta de nuevo')
    expect(result.error).not.toBe('Credenciales inválidas')
  })

  it('trata un 200 con cuerpo malformado (sin session) como fallo de servicio', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    const result = await signInWithIdentifier('gerardo_99', 'contrasena12')
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

  // Con confirmaciones activas, GoTrue solo ofusca el registro duplicado de
  // un correo SIN confirmar (reenvía el correo y responde como si fuera
  // nuevo). Un correo YA confirmado responde distinto: user_already_exists.
  // Sin este caso especial, esa diferencia es justo el oráculo que
  // enable_confirmations se activó para cerrar — un atacante que registre
  // un correo ajeno aprendería si ya tiene cuenta en Trainway por el solo
  // mensaje de error.
  it('trata un correo ya confirmado como éxito, para no delatar que la cuenta existe', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    })
    const result = await signUpWithPassword('ya@existe.com', 'contrasena12', 'gerardo_99')
    expect(result.error).toBeNull()
  })

  it('traduce cualquier otro fallo de signUp a un mensaje genérico', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { code: 'unexpected_failure', message: 'boom' },
    })
    const result = await signUpWithPassword('a@b.com', 'contrasena12', 'gerardo_99')
    expect(result.error).toBe('No se pudo crear la cuenta')
  })

  // El username no lo escribe el cliente (sin sesión, sin permiso de UPDATE):
  // viaja en los metadatos para que lo escriba el trigger handle_new_user,
  // que corre como dueño de la tabla.
  it('manda el username en los metadatos de signUp, no como escritura aparte', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await signUpWithPassword('a@b.com', 'contrasena12', 'gerardo_99')
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'contrasena12',
      options: { data: { username: 'gerardo_99' } },
    })
  })

  // Sin este recorte, un espacio al final pasa validateUsername (que sí
  // recorta) pero viaja crudo en los metadatos -- y handle_new_user lo
  // rechazaría por formato (mismo regex que el CHECK), dejando el perfil
  // sin username en silencio: el mismo síntoma permanente que Finding 5
  // arregla para colisiones, pero por espacios en vez de por otro usuario.
  it('recorta espacios del username antes de mandarlo en los metadatos', async () => {
    signUpMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    await signUpWithPassword('a@b.com', 'contrasena12', ' gerardo_99 ')
    expect(signUpMock).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'contrasena12',
      options: { data: { username: 'gerardo_99' } },
    })
  })
})
