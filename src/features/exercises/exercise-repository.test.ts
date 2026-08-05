import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectMock = vi.fn()
const rangeMock = vi.fn()

// El módulo real revienta al cargar si faltan las variables de entorno, así que
// se simula: `pnpm test` tiene que pasar en un clon limpio sin .env.local.
// La cadena imita la de postgrest-js: select().order().range() y ahí se espera.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        selectMock(...args)
        return {
          order: () => ({ range: (...r: unknown[]) => rangeMock(...r) }),
        }
      },
    }),
  },
}))

const { fetchAllExercises, exerciseImageUrl } = await import('./exercise-repository')

describe('exercise-repository', () => {
  beforeEach(() => {
    selectMock.mockReset()
    rangeMock.mockReset()
  })

  it('convierte las columnas snake_case del servidor a camelCase', async () => {
    rangeMock.mockResolvedValue({
      data: [
        {
          id: 'squat',
          name: 'Sentadilla',
          category: 'strength',
          equipment: 'barbell',
          force: 'push',
          level: 'intermediate',
          mechanic: 'compound',
          primary_muscles: ['quadriceps'],
          secondary_muscles: ['glutes'],
          instructions: ['Baja', 'Sube'],
          image_paths: ['Squat/0.jpg'],
        },
      ],
      error: null,
    })

    const exercises = await fetchAllExercises()

    expect(exercises).toHaveLength(1)
    expect(exercises[0]).toEqual({
      id: 'squat',
      name: 'Sentadilla',
      category: 'strength',
      equipment: 'barbell',
      force: 'push',
      level: 'intermediate',
      mechanic: 'compound',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes'],
      instructions: ['Baja', 'Sube'],
      imagePaths: ['Squat/0.jpg'],
    })
  })

  it('sustituye por arreglos vacíos las columnas nulas', async () => {
    rangeMock.mockResolvedValue({
      data: [
        {
          id: 'x',
          name: 'X',
          primary_muscles: null,
          secondary_muscles: null,
          instructions: null,
          image_paths: null,
        },
      ],
      error: null,
    })

    const [exercise] = await fetchAllExercises()

    expect(exercise.primaryMuscles).toEqual([])
    expect(exercise.secondaryMuscles).toEqual([])
    expect(exercise.instructions).toEqual([])
    expect(exercise.imagePaths).toEqual([])
  })

  it('devuelve vacío cuando el catálogo está vacío', async () => {
    rangeMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchAllExercises()).toEqual([])
  })

  it('lanza cuando el servidor devuelve error', async () => {
    rangeMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(fetchAllExercises()).rejects.toThrow(/catálogo/i)
  })

  it('lanza sin filtrar el mensaje interno del servidor', async () => {
    rangeMock.mockResolvedValue({
      data: null,
      error: { message: 'relation "public.exercises" does not exist' },
    })
    await expect(fetchAllExercises()).rejects.not.toThrow(/relation/)
  })

  it('pide una sola página cuando el catálogo cabe en ella', async () => {
    rangeMock.mockResolvedValue({ data: [{ id: 'a', name: 'A' }], error: null })

    await fetchAllExercises()

    expect(rangeMock).toHaveBeenCalledOnce()
    expect(rangeMock).toHaveBeenCalledWith(0, 499)
  })

  it('sigue pidiendo mientras las páginas vengan llenas', async () => {
    const full = Array.from({ length: 500 }, (_, index) => ({
      id: `a${index}`,
      name: `A${index}`,
    }))
    const partial = [{ id: 'z', name: 'Z' }]

    rangeMock
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: partial, error: null })

    const exercises = await fetchAllExercises()

    // Sin paginar, PostgREST cortaría en 1000 filas sin avisar y el catálogo
    // llegaría incompleto a un usuario con muchos ejercicios propios.
    expect(exercises).toHaveLength(501)
    expect(rangeMock).toHaveBeenCalledTimes(2)
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 499)
    expect(rangeMock).toHaveBeenNthCalledWith(2, 500, 999)
  })

  it('para cuando una página vuelve vacía', async () => {
    const full = Array.from({ length: 500 }, (_, index) => ({
      id: `a${index}`,
      name: `A${index}`,
    }))

    rangeMock
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    expect(await fetchAllExercises()).toHaveLength(500)
    expect(rangeMock).toHaveBeenCalledTimes(2)
  })

  it('propaga el error de una página posterior, no solo de la primera', async () => {
    const full = Array.from({ length: 500 }, (_, index) => ({
      id: `a${index}`,
      name: `A${index}`,
    }))

    rangeMock
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await expect(fetchAllExercises()).rejects.toThrow(/catálogo/i)
  })

  it('arma la URL pública de una imagen', () => {
    expect(exerciseImageUrl('Squat/0.jpg')).toBe(
      'http://127.0.0.1:54321/storage/v1/object/public/exercise-images/Squat/0.jpg',
    )
  })

  it('arma la URL de una ruta con caracteres especiales', () => {
    expect(exerciseImageUrl('3_4_Sit-Up/0.jpg')).toContain('3_4_Sit-Up/0.jpg')
  })
})
