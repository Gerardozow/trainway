import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../lib/db'
import {
  startWorkout,
  getActiveWorkout,
  addSet,
  removeSet,
  getSetsFor,
  finishWorkout,
  pendingCount,
  allSets,
} from './workout-local'

const USER = '11111111-1111-1111-1111-111111111111'
const EXERCISE = 'squat'

describe('workout-local', () => {
  beforeEach(async () => {
    await db.workouts.clear()
    await db.workoutSets.clear()
    await db.syncQueue.clear()
  })

  it('no hay entreno activo al empezar', async () => {
    expect(await getActiveWorkout()).toBeNull()
  })

  it('crea un entreno activo con identificador propio', async () => {
    const workout = await startWorkout(USER)

    expect(workout.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(workout.endedAt).toBeNull()
    expect(workout.userId).toBe(USER)
    expect(await getActiveWorkout()).toMatchObject({ id: workout.id })
  })

  it('encola el entreno para subirlo', async () => {
    await startWorkout(USER)
    expect(await pendingCount()).toBe(1)
  })

  it('registra una serie y la devuelve en el listado', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 8, weight: 60 })

    const sets = await getSetsFor(workout.id)
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ reps: 8, weight: 60, setIndex: 0 })
  })

  it('numera las series por ejercicio dentro del entreno', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 8, weight: 60 })
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 6, weight: 65 })
    await addSet({ workoutId: workout.id, exerciseId: 'bench', reps: 10, weight: 40 })

    const sets = await getSetsFor(workout.id)

    expect(
      sets.filter((s) => s.exerciseId === EXERCISE).map((s) => s.setIndex),
    ).toEqual([0, 1])
    expect(sets.filter((s) => s.exerciseId === 'bench').map((s) => s.setIndex)).toEqual([
      0,
    ])
  })

  it('acepta el peso corporal como cero', async () => {
    const workout = await startWorkout(USER)
    const set = await addSet({
      workoutId: workout.id,
      exerciseId: EXERCISE,
      reps: 12,
      weight: 0,
    })

    expect(set.weight).toBe(0)
  })

  it('rechaza repeticiones no positivas', async () => {
    const workout = await startWorkout(USER)
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 0, weight: 60 }),
    ).rejects.toThrow()
  })

  it('rechaza repeticiones con decimales', async () => {
    const workout = await startWorkout(USER)
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 5.5, weight: 60 }),
    ).rejects.toThrow()
  })

  it('rechaza un peso negativo', async () => {
    const workout = await startWorkout(USER)
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 5, weight: -1 }),
    ).rejects.toThrow()
  })

  it('rechaza valores fuera de los límites que acepta la base', async () => {
    const workout = await startWorkout(USER)
    // Sin este tope la serie se guardaría local y luego la cola se atoraría
    // para siempre contra el CHECK del servidor.
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 5, weight: 5000 }),
    ).rejects.toThrow()
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 1001, weight: 60 }),
    ).rejects.toThrow()
  })

  it('no encola una serie que rechazó', async () => {
    const workout = await startWorkout(USER)
    await expect(
      addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 0, weight: 60 }),
    ).rejects.toThrow()

    // Solo la del entreno.
    expect(await pendingCount()).toBe(1)
    expect(await getSetsFor(workout.id)).toHaveLength(0)
  })

  it('encola cada serie además del entreno', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 8, weight: 60 })
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 6, weight: 65 })

    expect(await pendingCount()).toBe(3)
  })

  it('borra una serie y la saca del listado', async () => {
    const workout = await startWorkout(USER)
    const set = await addSet({
      workoutId: workout.id,
      exerciseId: EXERCISE,
      reps: 8,
      weight: 60,
    })

    await removeSet(set.id)

    expect(await getSetsFor(workout.id)).toHaveLength(0)
  })

  it('cierra el entreno y deja de estar activo', async () => {
    const workout = await startWorkout(USER)
    await finishWorkout(workout.id)

    expect(await getActiveWorkout()).toBeNull()
    expect((await db.workouts.get(workout.id))?.endedAt).not.toBeNull()
  })

  it('sobrevive a un reinicio de la aplicación', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: EXERCISE, reps: 8, weight: 60 })

    // Se vuelve a leer desde cero, sin nada en memoria: es lo que pasa cuando
    // el teléfono mata la app a media serie.
    const active = await getActiveWorkout()
    expect(active?.id).toBe(workout.id)
    expect(await getSetsFor(workout.id)).toHaveLength(1)
  })

  it('devuelve el entreno abierto más reciente si hubiera varios', async () => {
    const first = await startWorkout(USER)
    await finishWorkout(first.id)
    const second = await startWorkout(USER)

    expect((await getActiveWorkout())?.id).toBe(second.id)
  })

  it('ordena las series por hora dentro del entreno', async () => {
    const workout = await startWorkout(USER)
    const a = await addSet({
      workoutId: workout.id,
      exerciseId: EXERCISE,
      reps: 8,
      weight: 60,
    })
    const b = await addSet({
      workoutId: workout.id,
      exerciseId: EXERCISE,
      reps: 6,
      weight: 65,
    })

    expect((await getSetsFor(workout.id)).map((s) => s.id)).toEqual([a.id, b.id])
  })

  it('ordena de forma determinista aunque dos series empaten en el instante', async () => {
    const workout = await startWorkout(USER)
    await addSet({ workoutId: workout.id, exerciseId: 'bench', reps: 8, weight: 60 })
    await addSet({ workoutId: workout.id, exerciseId: 'squat', reps: 8, weight: 60 })
    await addSet({ workoutId: workout.id, exerciseId: 'bench', reps: 6, weight: 65 })

    // Se fuerza el empate: sin desempate el orden dependería de cómo devuelva
    // IndexedDB, que va por identificador aleatorio.
    const instant = new Date().toISOString()
    for (const set of await db.workoutSets.toArray()) {
      await db.workoutSets.update(set.id, { completedAt: instant })
    }

    const first = (await getSetsFor(workout.id)).map((s) => `${s.exerciseId}:${s.setIndex}`)
    const second = (await getSetsFor(workout.id)).map(
      (s) => `${s.exerciseId}:${s.setIndex}`,
    )

    expect(first).toEqual(['bench:0', 'bench:1', 'squat:0'])
    expect(second).toEqual(first)
  })

  it('allSets devuelve el historial completo para calcular la última vez', async () => {
    const first = await startWorkout(USER)
    await addSet({ workoutId: first.id, exerciseId: EXERCISE, reps: 8, weight: 60 })
    await finishWorkout(first.id)

    const second = await startWorkout(USER)
    await addSet({ workoutId: second.id, exerciseId: EXERCISE, reps: 6, weight: 70 })

    expect(await allSets()).toHaveLength(2)
  })
})
