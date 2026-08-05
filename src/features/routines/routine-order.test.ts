import { describe, it, expect } from 'vitest'
import { moveExercise } from './routine-order'
import type { RoutineExercise } from './routine-types'

function item(exerciseId: string, position: number): RoutineExercise {
  return {
    id: `id-${exerciseId}`,
    routineId: 'r1',
    exerciseId,
    position,
    targetSets: null,
    targetReps: null,
    targetWeight: null,
    notes: null,
  }
}

const LIST: RoutineExercise[] = [item('a', 0), item('b', 1), item('c', 2), item('d', 3)]

function ids(items: RoutineExercise[]): string[] {
  return items.map((entry) => entry.exerciseId)
}

describe('moveExercise', () => {
  it('mueve un elemento hacia abajo', () => {
    expect(ids(moveExercise(LIST, 0, 1))).toEqual(['b', 'a', 'c', 'd'])
  })

  it('mueve un elemento hacia arriba', () => {
    expect(ids(moveExercise(LIST, 3, 2))).toEqual(['a', 'b', 'd', 'c'])
  })

  it('mueve al principio', () => {
    expect(ids(moveExercise(LIST, 2, 0))).toEqual(['c', 'a', 'b', 'd'])
  })

  it('mueve al final', () => {
    expect(ids(moveExercise(LIST, 0, 3))).toEqual(['b', 'c', 'd', 'a'])
  })

  it('no cambia nada al mover a la misma posición', () => {
    expect(ids(moveExercise(LIST, 2, 2))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('renumera las posiciones de cero en adelante, sin huecos', () => {
    expect(moveExercise(LIST, 0, 3).map((entry) => entry.position)).toEqual([0, 1, 2, 3])
  })

  it('renumera aunque la lista de entrada venga con posiciones sueltas', () => {
    const messy = [item('a', 5), item('b', 9), item('c', 40)]
    expect(moveExercise(messy, 0, 2).map((entry) => entry.position)).toEqual([0, 1, 2])
  })

  it('ignora un origen fuera de rango', () => {
    expect(ids(moveExercise(LIST, 9, 0))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(moveExercise(LIST, -1, 0))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignora un destino fuera de rango', () => {
    expect(ids(moveExercise(LIST, 0, 9))).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(moveExercise(LIST, 0, -1))).toEqual(['a', 'b', 'c', 'd'])
  })

  it('funciona con un solo elemento', () => {
    const single = [item('a', 0)]
    expect(ids(moveExercise(single, 0, 0))).toEqual(['a'])
  })

  it('funciona con la lista vacía', () => {
    expect(moveExercise([], 0, 0)).toEqual([])
  })

  it('no muta la lista que recibe', () => {
    const original = LIST.map((entry) => ({ ...entry }))
    moveExercise(LIST, 0, 3)
    expect(LIST).toEqual(original)
  })

  it('conserva los objetivos de cada ejercicio al mover', () => {
    const withTargets = [
      { ...item('a', 0), targetSets: 4, targetReps: 8 },
      { ...item('b', 1), targetSets: 3, targetReps: 12 },
    ]

    const moved = moveExercise(withTargets, 0, 1)

    expect(moved[0]).toMatchObject({ exerciseId: 'b', targetSets: 3, targetReps: 12 })
    expect(moved[1]).toMatchObject({ exerciseId: 'a', targetSets: 4, targetReps: 8 })
  })
})
