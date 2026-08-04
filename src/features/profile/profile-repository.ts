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

  const { error } = await supabase
    .from('profiles')
    .update({ username, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (!error) return { error: null }
  // 23505 es violación de unicidad en Postgres.
  if (error.code === '23505') return { error: 'Ese username ya está tomado' }
  return { error: 'No se pudo guardar el username' }
}
