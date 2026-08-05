// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminClient, anonClient, createTestUser } from './client'

describe('RLS de routines y routine_exercises', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let bob: Awaited<ReturnType<typeof createTestUser>>
  let aliceRoutineId: string
  let aliceItemId: string
  let exerciseId: string

  beforeAll(async () => {
    const stamp = crypto.randomUUID().slice(0, 8)
    alice = await createTestUser(`r-alice-${stamp}@trainway.test`)
    bob = await createTestUser(`r-bob-${stamp}@trainway.test`)

    exerciseId = `r_ex_${stamp}`
    aliceRoutineId = randomUUID()
    aliceItemId = randomUUID()

    const admin = adminClient()
    const { error: exerciseError } = await admin
      .from('exercises')
      .insert({ id: exerciseId, name: 'Ejercicio de rutina', owner_id: null })
    if (exerciseError) throw exerciseError

    const { error: routineError } = await alice.client.from('routines').insert({
      id: aliceRoutineId,
      owner_id: alice.id,
      name: 'Pierna',
    })
    if (routineError) throw routineError

    const { error: itemError } = await alice.client.from('routine_exercises').insert({
      id: aliceItemId,
      routine_id: aliceRoutineId,
      exercise_id: exerciseId,
      position: 0,
      target_sets: 4,
      target_reps: 8,
    })
    if (itemError) throw itemError
  }, 30_000)

  // Hay que borrar antes las rutinas: sus ejercicios referencian el ejercicio
  // de prueba por llave foránea y el borrado fallaría en silencio, dejando un
  // ejercicio de prueba en el catálogo real de la pantalla.
  afterAll(async () => {
    const admin = adminClient()
    await admin.from('routines').delete().eq('owner_id', alice.id)
    await admin.from('routines').delete().eq('owner_id', bob.id)

    const { error } = await admin.from('exercises').delete().eq('id', exerciseId)
    if (error) throw error
  })

  it('deja al dueño leer su rutina', async () => {
    const { data, error } = await alice.client
      .from('routines')
      .select('id, name')
      .eq('id', aliceRoutineId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.name).toBe('Pierna')
  })

  it('esconde la rutina de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('routines')
      .select('id')
      .eq('id', aliceRoutineId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('niega el acceso a un visitante sin sesión', async () => {
    const { error } = await anonClient().from('routines').select('id').limit(1)
    expect(error?.code).toBe('42501')
  })

  it('impide a Bob crear una rutina a nombre de Alice', async () => {
    const { error } = await bob.client.from('routines').insert({
      id: randomUUID(),
      owner_id: alice.id,
      name: 'Secuestrada',
    })

    expect(error?.code).toBe('42501')
  })

  it('impide a Bob modificar la rutina de Alice', async () => {
    const { data, error } = await bob.client
      .from('routines')
      .update({ name: 'Secuestrada' })
      .eq('id', aliceRoutineId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide a Bob borrar la rutina de Alice', async () => {
    const { data, error } = await bob.client
      .from('routines')
      .delete()
      .eq('id', aliceRoutineId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('esconde los ejercicios de la rutina de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('routine_exercises')
      .select('id')
      .eq('id', aliceItemId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('impide a Bob meter un ejercicio en la rutina de Alice', async () => {
    const { error } = await bob.client.from('routine_exercises').insert({
      id: randomUUID(),
      routine_id: aliceRoutineId,
      exercise_id: exerciseId,
      position: 1,
    })

    expect(error?.code).toBe('42501')
  })

  it('rechaza un nombre vacío', async () => {
    const { error } = await alice.client.from('routines').insert({
      id: randomUUID(),
      owner_id: alice.id,
      name: '',
    })

    expect(error?.code).toBe('23514')
  })

  it('rechaza un nombre demasiado largo', async () => {
    const { error } = await alice.client.from('routines').insert({
      id: randomUUID(),
      owner_id: alice.id,
      name: 'a'.repeat(81),
    })

    expect(error?.code).toBe('23514')
  })

  it('rechaza series objetivo fuera de rango', async () => {
    const { error } = await alice.client.from('routine_exercises').insert({
      id: randomUUID(),
      routine_id: aliceRoutineId,
      exercise_id: exerciseId,
      position: 90,
      target_sets: 999,
    })

    expect(error?.code).toBe('23514')
  })

  it('rechaza dos ejercicios en la misma posición de la misma rutina', async () => {
    const { error } = await alice.client.from('routine_exercises').insert({
      id: randomUUID(),
      routine_id: aliceRoutineId,
      exercise_id: exerciseId,
      position: 0,
    })

    expect(error?.code).toBe('23505')
  })

  it('borra en cascada los ejercicios al borrar la rutina', async () => {
    const routineId = randomUUID()
    const itemId = randomUUID()

    await alice.client
      .from('routines')
      .insert({ id: routineId, owner_id: alice.id, name: 'Temporal' })
    await alice.client.from('routine_exercises').insert({
      id: itemId,
      routine_id: routineId,
      exercise_id: exerciseId,
      position: 0,
    })

    await alice.client.from('routines').delete().eq('id', routineId)

    const { data } = await alice.client
      .from('routine_exercises')
      .select('id')
      .eq('id', itemId)
      .maybeSingle()

    expect(data).toBeNull()
  })

  it('conserva el entreno al borrar la rutina que lo originó', async () => {
    const routineId = randomUUID()
    const workoutId = randomUUID()

    await alice.client
      .from('routines')
      .insert({ id: routineId, owner_id: alice.id, name: 'Para borrar' })
    await alice.client.from('workouts').insert({
      id: workoutId,
      user_id: alice.id,
      routine_id: routineId,
      started_at: new Date().toISOString(),
    })

    await alice.client.from('routines').delete().eq('id', routineId)

    // El historial es del usuario; la rutina solo decía de dónde salió.
    const { data } = await alice.client
      .from('workouts')
      .select('id, routine_id')
      .eq('id', workoutId)
      .maybeSingle()

    expect(data?.id).toBe(workoutId)
    expect(data?.routine_id).toBeNull()
  })

  it('guarda y reordena los ejercicios en una sola transacción', async () => {
    const routineId = randomUUID()
    const a = randomUUID()
    const b = randomUUID()

    await alice.client
      .from('routines')
      .insert({ id: routineId, owner_id: alice.id, name: 'Reordenar' })

    const items = [
      { id: a, exercise_id: exerciseId, position: 0, target_sets: 4, target_reps: 8 },
      { id: b, exercise_id: exerciseId, position: 1, target_sets: 3, target_reps: 12 },
    ]

    const first = await alice.client.rpc('save_routine_exercises', {
      p_routine_id: routineId,
      p_items: items,
    })
    expect(first.error).toBeNull()

    // Intercambiarlos: sin la función, dos update sueltos chocarían contra el
    // índice único de posición a mitad de camino.
    const swapped = [
      { ...items[0], position: 1 },
      { ...items[1], position: 0 },
    ]
    const second = await alice.client.rpc('save_routine_exercises', {
      p_routine_id: routineId,
      p_items: swapped,
    })
    expect(second.error).toBeNull()

    const { data } = await alice.client
      .from('routine_exercises')
      .select('id, position')
      .eq('routine_id', routineId)
      .order('position')

    expect(data?.map((row) => row.id)).toEqual([b, a])
  })

  it('quita los ejercicios que ya no están en la lista', async () => {
    const routineId = randomUUID()
    const a = randomUUID()
    const b = randomUUID()

    await alice.client
      .from('routines')
      .insert({ id: routineId, owner_id: alice.id, name: 'Quitar' })

    await alice.client.rpc('save_routine_exercises', {
      p_routine_id: routineId,
      p_items: [
        { id: a, exercise_id: exerciseId, position: 0 },
        { id: b, exercise_id: exerciseId, position: 1 },
      ],
    })

    await alice.client.rpc('save_routine_exercises', {
      p_routine_id: routineId,
      p_items: [{ id: b, exercise_id: exerciseId, position: 0 }],
    })

    const { data } = await alice.client
      .from('routine_exercises')
      .select('id')
      .eq('routine_id', routineId)

    expect(data?.map((row) => row.id)).toEqual([b])
  })

  it('impide a Bob guardar ejercicios en la rutina de Alice', async () => {
    const { error } = await bob.client.rpc('save_routine_exercises', {
      p_routine_id: aliceRoutineId,
      p_items: [{ id: randomUUID(), exercise_id: exerciseId, position: 0 }],
    })

    // Falla ruidosamente en vez de no hacer nada en silencio: si no dijera
    // nada, el cliente creería que guardó.
    expect(error?.code).toBe('42501')
  })

  it('niega la función a un visitante sin sesión', async () => {
    const { error } = await anonClient().rpc('save_routine_exercises', {
      p_routine_id: aliceRoutineId,
      p_items: [],
    })

    expect(error).not.toBeNull()
  })
})
