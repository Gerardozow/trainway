// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Aislamiento entre usuarios.
 *
 * Estas políticas SON la seguridad del sistema: el navegador habla directo con
 * Postgres usando la anon key, así que si una política falla, un usuario lee
 * los datos de otro. Es la única forma de comprobarlo de verdad.
 *
 * Crea dos usuarios ya confirmados con la service_role (el proyecto pide
 * confirmación por email y sin ella no habría sesión) y los borra al terminar,
 * pase lo que pase.
 *
 * Se salta sin SUPABASE_SERVICE_ROLE_KEY.
 */
const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY

const enabled = Boolean(URL && ANON && SERVICE)
const suite = enabled ? describe : describe.skip

suite('aislamiento RLS entre usuarios', () => {
  let admin: SupabaseClient
  let alice: SupabaseClient
  let bob: SupabaseClient
  let aliceId = ''
  let bobId = ''
  let aliceProgramId = ''
  let aliceDayId = ''

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } })

    const stamp = Date.now()
    const crear = async (quien: string) => {
      const email = `rls-${quien}-${stamp}@trainway.test`
      const password = `prueba-rls-${stamp}`

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) throw error

      const client = createClient(URL!, ANON!, { auth: { persistSession: false } })
      const { error: signInError } = await client.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError

      return { id: data.user!.id, client }
    }

    const a = await crear('alice')
    const b = await crear('bob')
    aliceId = a.id
    alice = a.client
    bobId = b.id
    bob = b.client

    const { data: program, error } = await alice
      .from('programs')
      .insert({ user_id: aliceId, name: 'Bloque de Alice', starts_on: '2026-08-05' })
      .select('id')
      .single()
    if (error) throw error
    aliceProgramId = program.id

    const { data: day, error: dayError } = await alice
      .from('program_days')
      .insert({ program_id: aliceProgramId, week: 1, day_index: 1, title: 'Empuje' })
      .select('id')
      .single()
    if (dayError) throw dayError
    aliceDayId = day.id
  }, 60_000)

  afterAll(async () => {
    // Limpieza incondicional: el proyecto no se queda con usuarios de prueba.
    for (const id of [aliceId, bobId].filter(Boolean)) {
      await admin.auth.admin.deleteUser(id).catch(() => {})
    }
  }, 30_000)

  it('Alice ve su propio programa', async () => {
    const { data } = await alice.from('programs').select('id')
    expect(data?.map((p) => p.id)).toContain(aliceProgramId)
  })

  it('Bob no ve ningún programa de Alice', async () => {
    const { data } = await bob.from('programs').select('id')
    expect(data ?? []).toHaveLength(0)
  })

  it('Bob no puede leer el programa de Alice ni sabiendo su id', async () => {
    const { data } = await bob.from('programs').select('id').eq('id', aliceProgramId)
    expect(data ?? []).toHaveLength(0)
  })

  it('Bob no puede modificar el programa de Alice', async () => {
    await bob.from('programs').update({ name: 'Secuestrado' }).eq('id', aliceProgramId)

    const { data } = await alice.from('programs').select('name').eq('id', aliceProgramId).single()
    expect(data?.name).toBe('Bloque de Alice')
  })

  it('Bob no puede borrar el programa de Alice', async () => {
    await bob.from('programs').delete().eq('id', aliceProgramId)

    const { data } = await alice.from('programs').select('id').eq('id', aliceProgramId)
    expect(data ?? []).toHaveLength(1)
  })

  it('Bob no ve los días del programa de Alice', async () => {
    const { data } = await bob.from('program_days').select('id').eq('id', aliceDayId)
    expect(data ?? []).toHaveLength(0)
  })

  it('Bob no puede colar días en el programa de Alice', async () => {
    const { error } = await bob
      .from('program_days')
      .insert({ program_id: aliceProgramId, week: 1, day_index: 2, title: 'Intruso' })
    expect(error).not.toBeNull()
  })

  it('Bob no puede crear un programa a nombre de Alice', async () => {
    const { error } = await bob
      .from('programs')
      .insert({ user_id: aliceId, name: 'Suplantado', starts_on: '2026-08-05' })
    expect(error).not.toBeNull()
  })

  it('Bob no ve el perfil de Alice', async () => {
    const { data } = await bob.from('profiles').select('id').eq('id', aliceId)
    expect(data ?? []).toHaveLength(0)
  })

  it('cualquiera autenticado puede leer las traducciones', async () => {
    const { error } = await bob.from('exercise_translations').select('exercise_id').limit(1)
    expect(error).toBeNull()
  })

  it('un usuario normal no puede escribir traducciones', async () => {
    const { error } = await bob
      .from('exercise_translations')
      .insert({ exercise_id: '__intruso__', locale: 'es', name: 'basura' })
    expect(error).not.toBeNull()
  })
})
