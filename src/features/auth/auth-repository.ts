import { supabase } from '../../lib/supabase'
import { setUsername, validateUsername } from '../profile/profile-repository'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export async function signInWithEmail(email: string): Promise<{ error: string | null }> {
  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Escribe un correo válido' }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/` },
  })

  if (error) return { error: 'No se pudo enviar el correo. Inténtalo en un minuto.' }
  return { error: null }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/` },
  })

  if (error) return { error: 'No se pudo abrir el acceso con Google' }
  return { error: null }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function signInWithIdentifier(
  identifier: string,
  password: string,
): Promise<{ error: string | null }> {
  if (identifier.trim().length === 0 || password.length === 0) {
    return { error: 'Escribe tu usuario o correo y tu contraseña' }
  }

  let payload: {
    session?: { access_token: string; refresh_token: string }
    error?: unknown
  }
  let status: number
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-in`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      },
    )
    status = response.status
    try {
      payload = await response.json()
    } catch {
      // Un cuerpo no-JSON es una página de error del gateway (502/504/etc,
      // HTML o texto plano), no la respuesta de nuestra función. Se
      // clasifica por estado como cualquier otro fallo más abajo, en vez de
      // culpar a la conexión de quien intenta entrar.
      payload = {}
    }

    if (!response.ok || !payload.session) {
      // Solo el propio veredicto de credenciales de la función (400) se
      // traduce al mensaje de credenciales. Cualquier otro estado —404 (la
      // función no está desplegada o cambió de nombre), 401 (JWT/anon key
      // mal configurada), 502/504 (el runtime no arrancó o expiró), 429
      // (límite de la plataforma), o un 200 con cuerpo malformado (sin
      // session)— viene del gateway o de un fallo inesperado, no de un
      // veredicto de credenciales, y decirle a quien entra que su
      // contraseña está mal por un problema de infraestructura es
      // justo lo que el override A existe para evitar.
      if (status === 400) return { error: 'Credenciales inválidas' }
      return {
        error:
          typeof payload.error === 'string'
            ? payload.error
            : 'Servicio no disponible, intenta de nuevo',
      }
    }
  } catch {
    return { error: 'No se pudo conectar. Revisa tu conexión.' }
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token,
  })

  if (error) return { error: 'No se pudo iniciar la sesión' }
  return { error: null }
}

export async function signUpWithPassword(
  email: string,
  password: string,
  username: string,
): Promise<{ error: string | null }> {
  if (!EMAIL_PATTERN.test(email)) return { error: 'Escribe un correo válido' }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: 'La contraseña necesita al menos 8 caracteres' }
  }

  const invalidUsername = validateUsername(username)
  if (invalidUsername) return { error: invalidUsername }

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    // Con confirmaciones activas, GoTrue solo ofusca el registro duplicado
    // de un correo SIN confirmar (reenvía el correo y responde como si
    // fuera nuevo). Un correo YA confirmado responde distinto:
    // user_already_exists. Sin este caso especial, esa diferencia es el
    // oráculo que activar enable_confirmations se propuso cerrar — un
    // atacante que registre un correo ajeno aprendería si ya tiene cuenta
    // en Trainway por el solo mensaje de error.
    if (error.code === 'user_already_exists') return { error: null }
    return { error: 'No se pudo crear la cuenta' }
  }

  // El trigger ya creó el perfil con username nulo. Si esta escritura falla
  // (por ejemplo porque alguien tomó el username en el intervalo), la cuenta
  // existe igual y UsernameOnboarding se lo pedirá al entrar. No se pierde nada.
  if (data.user) {
    await setUsername(data.user.id, username)
  }

  return { error: null }
}
