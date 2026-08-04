import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.VITE_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function anonClient(): SupabaseClient {
  return createClient(URL, ANON)
}

export function adminClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Crea un usuario confirmado y devuelve un cliente que actúa como él.
 * La contraseña es fija porque solo existe dentro de la base local de pruebas.
 */
export async function createTestUser(email: string) {
  const password = 'test-password-123456'
  const admin = adminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const client = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { id: data.user!.id, client }
}
