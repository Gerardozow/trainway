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

  it('devuelve null para un username que no existe', async () => {
    const { data, error } = await adminClient().rpc('email_for_username', {
      p_username: 'no_existe_jamas',
    })

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('niega la búsqueda de correo a un visitante sin sesión', async () => {
    const { error } = await anonClient().rpc('email_for_username', {
      p_username: username,
    })

    expect(error).not.toBeNull()
  })

  it('niega la búsqueda de correo a un usuario con sesión', async () => {
    const { error } = await alice.client.rpc('email_for_username', {
      p_username: username,
    })

    expect(error).not.toBeNull()
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
})
