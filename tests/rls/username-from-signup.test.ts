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

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, username')
    .eq('id', data.user!.id)
    .single()

  // Sin esto, si el manejador de unique_violation solo tragara el error sin
  // reintentar el insert (en vez de crear el perfil con username nulo), el
  // trigger dejaría cero filas de perfil. `.single()` devolvería entonces
  // PGRST116 (cero filas) y, si ese error se descartara como antes, este
  // helper devolvería null — el mismo valor que un perfil real con username
  // nulo. Las pruebas de colisión pasarían igual aunque no exista fila de
  // perfil alguna, que es justo el estado que "una cuenta nunca se pierde"
  // dice que no puede pasar. Propagar el error y afirmar el id fuerza a que
  // la fila exista de verdad.
  if (profileError) throw profileError
  expect(profile.id).toBe(data.user!.id)

  return profile.username
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
