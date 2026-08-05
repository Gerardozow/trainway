// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { adminClient, anonClient, createTestUser } from './client'

describe('RLS de exercises', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let bob: Awaited<ReturnType<typeof createTestUser>>
  let globalId: string
  let aliceExerciseId: string

  beforeAll(async () => {
    const stamp = crypto.randomUUID().slice(0, 8)
    alice = await createTestUser(`ex-alice-${stamp}@trainway.test`)
    bob = await createTestUser(`ex-bob-${stamp}@trainway.test`)

    globalId = `global_${stamp}`
    aliceExerciseId = `alice_${stamp}`

    const admin = adminClient()
    const { error } = await admin.from('exercises').insert([
      { id: globalId, name: 'Sentadilla global', owner_id: null },
      { id: aliceExerciseId, name: 'Ejercicio de Alice', owner_id: alice.id },
    ])
    if (error) throw error
  }, 30_000)

  it('deja leer el catálogo global a un visitante sin sesión', async () => {
    const { data, error } = await anonClient()
      .from('exercises')
      .select('id, name')
      .eq('id', globalId)
      .single()

    expect(error).toBeNull()
    expect(data?.name).toBe('Sentadilla global')
  })

  it('deja al dueño leer su propio ejercicio', async () => {
    const { data, error } = await alice.client
      .from('exercises')
      .select('id')
      .eq('id', aliceExerciseId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.id).toBe(aliceExerciseId)
  })

  it('esconde el ejercicio propio de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('exercises')
      .select('id')
      .eq('id', aliceExerciseId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('esconde el ejercicio propio de Alice a un visitante sin sesión', async () => {
    const { data, error } = await anonClient()
      .from('exercises')
      .select('id')
      .eq('id', aliceExerciseId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('impide a Bob modificar el ejercicio de Alice', async () => {
    const { data, error } = await bob.client
      .from('exercises')
      .update({ name: 'secuestrado' })
      .eq('id', aliceExerciseId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide a Bob borrar el ejercicio de Alice', async () => {
    const { data, error } = await bob.client
      .from('exercises')
      .delete()
      .eq('id', aliceExerciseId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide a un usuario modificar un ejercicio del catálogo global', async () => {
    const { data, error } = await alice.client
      .from('exercises')
      .update({ name: 'secuestrado' })
      .eq('id', globalId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide crear un ejercicio a nombre de otro usuario', async () => {
    const { error } = await bob.client.from('exercises').insert({
      id: `impostor_${crypto.randomUUID().slice(0, 8)}`,
      name: 'Impostor',
      owner_id: alice.id,
    })

    expect(error?.code).toBe('42501')
  })

  it('impide crear un ejercicio global desde el cliente', async () => {
    const { error } = await alice.client.from('exercises').insert({
      id: `falso_global_${crypto.randomUUID().slice(0, 8)}`,
      name: 'Falso global',
      owner_id: null,
    })

    expect(error?.code).toBe('42501')
  })
})
