import { supabase } from '../../lib/supabase'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
