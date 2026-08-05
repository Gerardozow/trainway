import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Aislamiento entre usuarios. Estas políticas SON la seguridad del sistema:
 * el navegador habla directo con Postgres con la anon key.
 *
 * Necesita una instancia de Supabase (local con `npx supabase start`). Sin
 * SUPABASE_TEST_URL el bloque se salta, para no romper CI sin infraestructura.
 */
const URL = process.env.SUPABASE_TEST_URL
const KEY = process.env.SUPABASE_TEST_ANON_KEY
const enabled = Boolean(URL && KEY)

const suite = enabled ? describe : describe.skip

suite('aislamiento RLS', () => {
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceProgramId: string

  beforeAll(async () => {
    const stamp = Date.now()
    const mk = async (email: string) => {
      const client = createClient(URL!, KEY!)
      const { error } = await client.auth.signUp({ email, password: 'contraseña-de-prueba-1' })
      if (error) throw error
      return client
    }
    alice = await mk(`alice-${stamp}@trainway.test`)
    bob = await mk(`bob-${stamp}@trainway.test`)

    const { data, error } = await alice
      .from('programs')
      .insert({ name: 'Bloque de Alice', starts_on: '2026-08-05', block_number: 1 })
      .select('id')
      .single()
    if (error) throw error
    aliceProgramId = data.id
  })

  it('Bob no ve los programas de Alice', async () => {
    const { data } = await bob.from('programs').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('Bob no puede leer un programa de Alice ni sabiendo su id', async () => {
    const { data } = await bob.from('programs').select('id').eq('id', aliceProgramId)
    expect(data ?? []).toHaveLength(0)
  })

  it('Bob no puede modificar un programa de Alice', async () => {
    const { data } = await bob
      .from('programs')
      .update({ name: 'Secuestrado' })
      .eq('id', aliceProgramId)
      .select()
    expect(data ?? []).toHaveLength(0)

    const { data: after } = await alice.from('programs').select('name').eq('id', aliceProgramId).single()
    expect(after?.name).toBe('Bloque de Alice')
  })

  it('Bob no puede insertar días en el programa de Alice', async () => {
    const { error } = await bob.from('program_days').insert({
      program_id: aliceProgramId,
      week: 1,
      day_index: 1,
      title: 'Intruso',
    })
    expect(error).not.toBeNull()
  })

  it('cualquiera puede leer las traducciones', async () => {
    const { error } = await bob.from('exercise_translations').select('exercise_id').limit(1)
    expect(error).toBeNull()
  })

  it('un usuario normal no puede escribir traducciones', async () => {
    const { error } = await bob
      .from('exercise_translations')
      .insert({ exercise_id: 'X', locale: 'es', name: 'X' })
    expect(error).not.toBeNull()
  })
})
