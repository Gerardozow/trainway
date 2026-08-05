import { supabase } from '../../lib/supabase'

export type Profile = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export function validateUsername(value: string): string | null {
  if (value.length < 3) return 'El username necesita al menos 3 caracteres'
  if (value.length > 20) return 'El username no puede pasar de 20 caracteres'
  if (!/^[a-z0-9_]+$/.test(value)) {
    return 'Solo minúsculas, números y guion bajo'
  }
  return null
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function setUsername(
  userId: string,
  username: string,
): Promise<{ error: string | null }> {
  const invalid = validateUsername(username)
  if (invalid) return { error: invalid }

  const { data, error } = await supabase
    .from('profiles')
    .update({ username, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select('id')

  if (error) {
    // 23505 es violación de unicidad en Postgres.
    if (error.code === '23505') return { error: 'Ese username ya está tomado' }
    return { error: 'No se pudo guardar el username' }
  }

  // `.update().eq()` sin `.select()` devuelve error: null tanto si RLS filtró
  // la fila (0 actualizadas) como si actualizó una. Sin este chequeo, un
  // perfil ausente hace que el onboarding "tenga éxito" sin haber guardado nada.
  if (!data || data.length === 0) {
    return { error: 'No se pudo guardar el username' }
  }

  return { error: null }
}

// El RPC puede fallar por razones ajenas a si el nombre está tomado: sin
// red, o PostgREST con el caché de esquema todavía sin recargar la función
// (PGRST202) tras un despliegue. Fallar cerrado ahí devolvería "tomado" y
// bloquearía el alta entera mientras dure el problema — perder una cuenta
// por una comprobación caída es peor motivo que perderla por una colisión
// real, que es justo lo que este chequeo existe para evitar. `null` dice
// "no se pudo saber" y deja que quien llama decida; el trigger
// handle_new_user es la garantía real, no este pre-chequeo.
export async function isUsernameAvailable(username: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('username_available', {
    p_username: username,
  })
  if (error) return null
  return data === true
}
