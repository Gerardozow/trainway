// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminClient, anonClient, createTestUser } from './client'

describe('RLS de workouts y workout_sets', () => {
  let alice: Awaited<ReturnType<typeof createTestUser>>
  let bob: Awaited<ReturnType<typeof createTestUser>>
  let aliceWorkoutId: string
  let aliceSetId: string
  let exerciseId: string

  beforeAll(async () => {
    const stamp = crypto.randomUUID().slice(0, 8)
    alice = await createTestUser(`w-alice-${stamp}@trainway.test`)
    bob = await createTestUser(`w-bob-${stamp}@trainway.test`)

    exerciseId = `w_ex_${stamp}`
    aliceWorkoutId = randomUUID()
    aliceSetId = randomUUID()

    const admin = adminClient()

    const { error: exerciseError } = await admin
      .from('exercises')
      .insert({ id: exerciseId, name: 'Sentadilla de prueba', owner_id: null })
    if (exerciseError) throw exerciseError

    const { error: workoutError } = await alice.client.from('workouts').insert({
      id: aliceWorkoutId,
      user_id: alice.id,
      started_at: new Date().toISOString(),
    })
    if (workoutError) throw workoutError

    const { error: setError } = await alice.client.from('workout_sets').insert({
      id: aliceSetId,
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 0,
      reps: 8,
      weight: 60,
      completed_at: new Date().toISOString(),
    })
    if (setError) throw setError
  }, 30_000)

  // El ejercicio de prueba es global y aparecería en el catálogo real.
  afterAll(async () => {
    await adminClient().from('exercises').delete().eq('id', exerciseId)
  })

  it('deja al dueño leer su entreno', async () => {
    const { data, error } = await alice.client
      .from('workouts')
      .select('id')
      .eq('id', aliceWorkoutId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.id).toBe(aliceWorkoutId)
  })

  it('esconde el entreno de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('workouts')
      .select('id')
      .eq('id', aliceWorkoutId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('esconde las series de Alice a Bob', async () => {
    const { data, error } = await bob.client
      .from('workout_sets')
      .select('id')
      .eq('id', aliceSetId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data).toBeNull()
  })

  it('niega todo acceso a un visitante sin sesión', async () => {
    const { error } = await anonClient().from('workouts').select('id').limit(1)
    expect(error?.code).toBe('42501')
  })

  it('niega también las series a un visitante sin sesión', async () => {
    const { error } = await anonClient().from('workout_sets').select('id').limit(1)
    expect(error?.code).toBe('42501')
  })

  it('impide a Bob crear un entreno a nombre de Alice', async () => {
    const { error } = await bob.client.from('workouts').insert({
      id: randomUUID(),
      user_id: alice.id,
      started_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('42501')
  })

  it('impide a Bob meter una serie en el entreno de Alice', async () => {
    const { error } = await bob.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 1,
      reps: 5,
      weight: 100,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('42501')
  })

  it('impide a Bob borrar el entreno de Alice', async () => {
    const { data, error } = await bob.client
      .from('workouts')
      .delete()
      .eq('id', aliceWorkoutId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('impide a Bob borrar una serie de Alice', async () => {
    const { data, error } = await bob.client
      .from('workout_sets')
      .delete()
      .eq('id', aliceSetId)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('rechaza repeticiones no positivas', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 2,
      reps: 0,
      weight: 60,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('23514')
  })

  it('rechaza un peso absurdo', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 3,
      reps: 5,
      weight: 5000,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('23514')
  })

  it('acepta el peso corporal como cero', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 4,
      reps: 12,
      weight: 0,
      completed_at: new Date().toISOString(),
    })

    expect(error).toBeNull()
  })

  it('rechaza un RPE fuera de rango', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: exerciseId,
      set_index: 5,
      reps: 5,
      weight: 60,
      rpe: 11,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('23514')
  })

  it('no deja actualizar una serie ya registrada, ni al dueño', async () => {
    // Sin grant de UPDATE, PostgREST responde permiso denegado. Es deliberado:
    // corregir una serie se hace borrándola y volviéndola a registrar.
    const { error } = await alice.client
      .from('workout_sets')
      .update({ reps: 99 })
      .eq('id', aliceSetId)

    expect(error?.code).toBe('42501')
  })

  it('rechaza una serie que apunta a un ejercicio inexistente', async () => {
    const { error } = await alice.client.from('workout_sets').insert({
      id: randomUUID(),
      workout_id: aliceWorkoutId,
      exercise_id: 'no_existe_jamas',
      set_index: 6,
      reps: 5,
      weight: 60,
      completed_at: new Date().toISOString(),
    })

    expect(error?.code).toBe('23503')
  })

  it('borra en cascada las series al borrar el entreno', async () => {
    const workoutId = randomUUID()
    const setId = randomUUID()

    await alice.client.from('workouts').insert({
      id: workoutId,
      user_id: alice.id,
      started_at: new Date().toISOString(),
    })
    await alice.client.from('workout_sets').insert({
      id: setId,
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_index: 0,
      reps: 5,
      weight: 50,
      completed_at: new Date().toISOString(),
    })

    await alice.client.from('workouts').delete().eq('id', workoutId)

    const { data } = await alice.client
      .from('workout_sets')
      .select('id')
      .eq('id', setId)
      .maybeSingle()

    expect(data).toBeNull()
  })
})
