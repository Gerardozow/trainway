import { describe, it, expect } from 'vitest'
import { searchExercises } from './searchExercises'
import type { Exercise } from './exercise-types'

function make(partial: Partial<Exercise> & { id: string; name: string }): Exercise {
  return {
    category: null,
    equipment: null,
    force: null,
    level: null,
    mechanic: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    imagePaths: [],
    ...partial,
  }
}

const CATALOG: Exercise[] = [
  make({ id: '1', name: 'Sentadilla con barra', primaryMuscles: ['quadriceps'] }),
  make({
    id: '2',
    name: 'Press de banca',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps'],
  }),
  make({ id: '3', name: 'Curl de bíceps', primaryMuscles: ['biceps'] }),
  make({
    id: '4',
    name: 'Peso muerto',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['quadriceps'],
  }),
]

describe('searchExercises', () => {
  it('devuelve todo sin filtros', () => {
    expect(searchExercises(CATALOG, '', null)).toHaveLength(4)
  })

  it('busca por fragmento del nombre', () => {
    expect(searchExercises(CATALOG, 'press', null).map((e) => e.id)).toEqual(['2'])
  })

  it('ignora mayúsculas y minúsculas', () => {
    expect(searchExercises(CATALOG, 'SENTADILLA', null)).toHaveLength(1)
  })

  it('encuentra el acentuado escribiendo sin acento', () => {
    expect(searchExercises(CATALOG, 'biceps', null).map((e) => e.id)).toEqual(['3'])
  })

  it('encuentra el acentuado escribiendo con acento', () => {
    expect(searchExercises(CATALOG, 'bíceps', null).map((e) => e.id)).toEqual(['3'])
  })

  it('filtra por músculo primario', () => {
    expect(searchExercises(CATALOG, '', 'chest').map((e) => e.id)).toEqual(['2'])
  })

  it('incluye el músculo secundario en el filtro', () => {
    expect(
      searchExercises(CATALOG, '', 'quadriceps')
        .map((e) => e.id)
        .sort(),
    ).toEqual(['1', '4'])
  })

  it('combina texto y músculo', () => {
    expect(searchExercises(CATALOG, 'peso', 'quadriceps').map((e) => e.id)).toEqual(['4'])
  })

  it('devuelve vacío cuando nada coincide', () => {
    expect(searchExercises(CATALOG, 'zancada', null)).toEqual([])
  })

  it('ignora espacios sobrantes en la consulta', () => {
    expect(searchExercises(CATALOG, '  press  ', null)).toHaveLength(1)
  })

  it('no muta el arreglo que recibe', () => {
    const original = [...CATALOG]
    searchExercises(CATALOG, 'press', 'chest')
    expect(CATALOG).toEqual(original)
  })
})
