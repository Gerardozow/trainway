import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectMock = vi.fn()

// El módulo real revienta al cargar si faltan las variables de entorno, así que
// se simula: `pnpm test` tiene que pasar en un clon limpio sin .env.local.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: (...args: unknown[]) => selectMock(...args) }),
  },
}))

const { fetchAllExercises, exerciseImageUrl } = await import('./exercise-repository')

describe('exercise-repository', () => {
  beforeEach(() => {
    selectMock.mockReset()
  })

  it('convierte las columnas snake_case del servidor a camelCase', async () => {
    selectMock.mockResolvedValue({
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
    selectMock.mockResolvedValue({
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
    selectMock.mockResolvedValue({ data: [], error: null })
    expect(await fetchAllExercises()).toEqual([])
  })

  it('lanza cuando el servidor devuelve error', async () => {
    selectMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(fetchAllExercises()).rejects.toThrow(/catálogo/i)
  })

  it('lanza sin filtrar el mensaje interno del servidor', async () => {
    selectMock.mockResolvedValue({
      data: null,
      error: { message: 'relation "public.exercises" does not exist' },
    })
    await expect(fetchAllExercises()).rejects.not.toThrow(/relation/)
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
