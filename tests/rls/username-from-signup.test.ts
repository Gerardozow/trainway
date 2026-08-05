// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { adminClient } from './client'

async function signUpWith(username: string | null, suffix: string) {
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: `signup-${suffix}@trainway.test`,
    password: 'contrasena-de-prueba-8',
    email_confirm: true,
    user_metadata: username === null ? {} : { username },
  })
  if (error) throw error

  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', data.user!.id)
    .single()

  return profile?.username ?? null
}

describe('username desde los metadatos del alta', () => {
  it('guarda el username que viene en los metadatos', async () => {
    const stamp = Date.now().toString().slice(-6)
    const username = `meta_${stamp}`
    expect(await signUpWith(username, `a${stamp}`)).toBe(username)
  }, 30_000)

  it('deja el perfil sin username cuando no viene ninguno', async () => {
    const stamp = Date.now().toString().slice(-6)
    expect(await signUpWith(null, `b${stamp}`)).toBeNull()
  }, 30_000)

  it('ignora un username con formato inválido en vez de abortar el alta', async () => {
    const stamp = Date.now().toString().slice(-6)
    expect(await signUpWith('MAYUSCULAS Y ESPACIOS', `c${stamp}`)).toBeNull()
  }, 30_000)

  it('crea la cuenta igual cuando el username ya está tomado', async () => {
    const stamp = Date.now().toString().slice(-6)
    const username = `dup_${stamp}`

    expect(await signUpWith(username, `d${stamp}`)).toBe(username)
    // El segundo pierde el nombre pero conserva la cuenta.
    expect(await signUpWith(username, `e${stamp}`)).toBeNull()
  }, 30_000)
})
