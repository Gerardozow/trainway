// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { adminClient, anonClient, createTestUser } from './client'

describe('RLS de profiles', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let bob: Awaited<ReturnType<typeof createTestUser>>

  beforeAll(async () => {
    const stamp = Date.now()
    alice = await createTestUser(`alice-${stamp}@trainway.test`)
    bob = await createTestUser(`bob-${stamp}@trainway.test`)
  }, 30_000)

  it('crea un perfil automáticamente al registrarse un usuario', async () => {
    const { data, error } = await adminClient()
      .from('profiles')
      .select('id')
      .eq('id', alice.id)
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe(alice.id)
  })

  it('permite al usuario actualizar su propio perfil', async () => {
    const { data, error } = await alice.client
      .from('profiles')
      .update({ username: `alice_${Date.now().toString().slice(-6)}` })
      .eq('id', alice.id)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('impide a un usuario modificar el perfil de otro', async () => {
    const { data, error } = await bob.client
      .from('profiles')
      .update({ username: 'secuestrado' })
      .eq('id', alice.id)
      .select()

    // RLS no lanza error: filtra la fila. Cero filas afectadas es el éxito.
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('rechaza un username con formato inválido', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ username: 'MAYÚSCULAS Y ESPACIOS' })
      .eq('id', alice.id)

    expect(error).not.toBeNull()
  })

  it('rechaza un username duplicado', async () => {
    const shared = `dup_${Date.now().toString().slice(-6)}`
    await alice.client.from('profiles').update({ username: shared }).eq('id', alice.id)

    const { error } = await bob.client
      .from('profiles')
      .update({ username: shared })
      .eq('id', bob.id)

    expect(error).not.toBeNull()
  })

  it('deja leer los perfiles a un visitante sin sesión', async () => {
    const { error } = await anonClient().from('profiles').select('username').limit(1)
    expect(error).toBeNull()
  })
})
