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
    error?: string
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
    payload = await response.json()
    if (!response.ok || !payload.session) {
      // La función distingue 503 (el servicio falló) de 400 (credenciales
      // rechazadas): colapsar ambos de vuelta a "Credenciales inválidas"
      // le diría a alguien que su contraseña está mal cuando el problema es
      // nuestro.
      if (status === 503) {
        return { error: payload.error ?? 'Servicio no disponible' }
      }
      return { error: 'Credenciales inválidas' }
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
  if (error) return { error: 'No se pudo crear la cuenta' }

  // El trigger ya creó el perfil con username nulo. Si esta escritura falla
  // (por ejemplo porque alguien tomó el username en el intervalo), la cuenta
  // existe igual y UsernameOnboarding se lo pedirá al entrar. No se pierde nada.
  if (data.user) {
    await setUsername(data.user.id, username)
  }

  return { error: null }
}
