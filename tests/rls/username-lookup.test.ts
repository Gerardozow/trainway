// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { adminClient, anonClient, createTestUser } from './client'

describe('funciones de búsqueda de username', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let email: string
  let username: string

  beforeAll(async () => {
    const stamp = Date.now().toString().slice(-6)
    email = `lookup-${stamp}@trainway.test`
    username = `lookup_${stamp}`
    alice = await createTestUser(email)
    const { error } = await alice.client
      .from('profiles')
      .update({ username })
      .eq('id', alice.id)
    if (error) throw error
  }, 30_000)

  it('devuelve el correo a quien usa la clave de servicio', async () => {
    const { data, error } = await adminClient().rpc('email_for_username', {
      p_username: username,
    })

    expect(error).toBeNull()
    expect(data).toBe(email)
  })

  it('encuentra el correo aunque el username venga en mayúsculas', async () => {
    const { data, error } = await adminClient().rpc('email_for_username', {
      p_username: username.toUpperCase(),
    })

    expect(error).toBeNull()
    expect(data).toBe(email)
  })

  it('devuelve null para un username que no existe', async () => {
    const { data, error } = await adminClient().rpc('email_for_username', {
      p_username: 'no_existe_jamas',
    })

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('niega la búsqueda de correo a un visitante sin sesión', async () => {
    const { data, error } = await anonClient().rpc('email_for_username', {
      p_username: username,
    })

    // Se afirman ambas cosas: un error (algo salió mal) por sí solo no
    // distingue "permiso denegado" de "la función no existe o el RPC está mal
    // escrito" — ambos casos producen un error no nulo. Lo que sí distingue
    // una denegación real es que el correo jamás viaja en `data`.
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('niega la búsqueda de correo a un usuario con sesión', async () => {
    const { data, error } = await alice.client.rpc('email_for_username', {
      p_username: username,
    })

    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  it('reporta un username tomado como no disponible', async () => {
    const { data, error } = await anonClient().rpc('username_available', {
      p_username: username,
    })

    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('reporta un username libre como disponible', async () => {
    const { data, error } = await anonClient().rpc('username_available', {
      p_username: 'libre_seguro_123',
    })

    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  // email_for_username hace lower(p_username) desde 0002; username_available
  // no lo hacía, así que un mismo username tomado reportaba "disponible" con
  // mayúsculas y "tomado" en minúsculas -- divergente y verificado en vivo.
  // SignupPage manda el username ya en minúsculas, pero cualquier otro
  // llamador del RPC (o una futura pantalla que no lo garantice) volvería a
  // ver la divergencia.
  it('reporta un username tomado como no disponible aunque venga en mayúsculas', async () => {
    const { data, error } = await anonClient().rpc('username_available', {
      p_username: username.toUpperCase(),
    })

    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})
