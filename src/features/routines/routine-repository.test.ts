import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectAfterOrder = vi.fn()
const maybeSingle = vi.fn()
const insertSingle = vi.fn()
const updateSelect = vi.fn()
const deleteSelect = vi.fn()
const rpcMock = vi.fn()

/**
 * Se simula el cliente: el módulo real revienta al cargar sin variables de
 * entorno, y `pnpm test` tiene que pasar en un clon limpio.
 */
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (table: string) => ({
      select: () => ({
        order: () => selectAfterOrder(table),
        eq: () => ({
          maybeSingle: () => maybeSingle(table),
          order: () => selectAfterOrder(table),
        }),
      }),
      insert: () => ({ select: () => ({ single: () => insertSingle() }) }),
      update: (values: unknown) => ({
        eq: () => ({ select: () => updateSelect(values) }),
      }),
      delete: () => ({ eq: () => ({ select: () => deleteSelect() }) }),
    }),
  },
}))

const {
  fetchRoutines,
  fetchRoutine,
  createRoutine,
  renameRoutine,
  deleteRoutine,
  saveExercises,
  validateRoutineName,
} = await import('./routine-repository')

const ROUTINE_ROW = {
  id: 'r1',
  owner_id: 'u1',
  name: 'Pierna',
  description: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-02T10:00:00Z',
}

describe('validateRoutineName', () => {
  it('acepta un nombre normal', () => {
    expect(validateRoutineName('Pierna')).toBeNull()
  })

  it('rechaza el vacío', () => {
    expect(validateRoutineName('')).not.toBeNull()
  })

  it('rechaza solo espacios', () => {
    expect(validateRoutineName('   ')).not.toBeNull()
  })

  it('rechaza más de 80 caracteres', () => {
    expect(validateRoutineName('a'.repeat(81))).toMatch(/80/)
  })

  it('acepta exactamente 80', () => {
    expect(validateRoutineName('a'.repeat(80))).toBeNull()
  })
})

describe('routine-repository', () => {
  beforeEach(() => {
    selectAfterOrder.mockReset()
    maybeSingle.mockReset()
    insertSingle.mockReset()
    updateSelect.mockReset()
    deleteSelect.mockReset()
    rpcMock.mockReset()
  })

  it('convierte las rutinas a camelCase', async () => {
    selectAfterOrder.mockResolvedValue({ data: [ROUTINE_ROW], error: null })

    const routines = await fetchRoutines()

    expect(routines[0]).toEqual({
      id: 'r1',
      ownerId: 'u1',
      name: 'Pierna',
      description: null,
      createdAt: '2026-08-01T10:00:00Z',
      updatedAt: '2026-08-02T10:00:00Z',
    })
  })

  it('lanza sin filtrar el mensaje del servidor al listar', async () => {
    selectAfterOrder.mockResolvedValue({
      data: null,
      error: { message: 'relation "routines" does not exist' },
    })

    await expect(fetchRoutines()).rejects.not.toThrow(/relation/)
  })

  it('devuelve null cuando la rutina no existe o no es tuya', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchRoutine('r1')).toBeNull()
  })

  it('trae la rutina con sus ejercicios ordenados', async () => {
    maybeSingle.mockResolvedValue({ data: ROUTINE_ROW, error: null })
    selectAfterOrder.mockResolvedValue({
      data: [
        {
          id: 'i1',
          routine_id: 'r1',
          exercise_id: 'squat',
          position: 0,
          target_sets: 4,
          target_reps: 8,
          target_weight: null,
          notes: null,
        },
      ],
      error: null,
    })

    const result = await fetchRoutine('r1')

    expect(result?.routine.name).toBe('Pierna')
    expect(result?.exercises[0]).toMatchObject({
      exerciseId: 'squat',
      targetSets: 4,
      targetReps: 8,
      targetWeight: null,
    })
  })

  it('no crea una rutina con nombre inválido, sin llamar a la red', async () => {
    const result = await createRoutine('u1', '   ')

    expect(result.error).not.toBeNull()
    expect(result.routine).toBeNull()
    expect(insertSingle).not.toHaveBeenCalled()
  })

  it('crea una rutina y la devuelve', async () => {
    insertSingle.mockResolvedValue({ data: ROUTINE_ROW, error: null })

    const result = await createRoutine('u1', '  Pierna  ')

    expect(result.error).toBeNull()
    expect(result.routine?.name).toBe('Pierna')
  })

  it('traduce el fallo del servidor al crear', async () => {
    insertSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const result = await createRoutine('u1', 'Pierna')

    expect(result.error).toBe('No se pudo crear la rutina')
  })

  it('renombra la rutina', async () => {
    updateSelect.mockResolvedValue({ data: [{ id: 'r1' }], error: null })
    expect(await renameRoutine('r1', 'Empuje')).toEqual({ error: null })
  })

  it('reporta error si el renombrado no tocó ninguna fila', async () => {
    // Sin esta comprobación, renombrar una rutina ajena devolvería éxito.
    updateSelect.mockResolvedValue({ data: [], error: null })
    expect((await renameRoutine('r1', 'Empuje')).error).not.toBeNull()
  })

  it('no renombra con un nombre inválido, sin llamar a la red', async () => {
    const result = await renameRoutine('r1', '')

    expect(result.error).not.toBeNull()
    expect(updateSelect).not.toHaveBeenCalled()
  })

  it('borra la rutina', async () => {
    deleteSelect.mockResolvedValue({ data: [{ id: 'r1' }], error: null })
    expect(await deleteRoutine('r1')).toEqual({ error: null })
  })

  it('reporta error si el borrado no tocó ninguna fila', async () => {
    deleteSelect.mockResolvedValue({ data: [], error: null })
    expect((await deleteRoutine('r1')).error).not.toBeNull()
  })

  it('guarda los ejercicios por la función y en snake_case', async () => {
    rpcMock.mockResolvedValue({ error: null })

    await saveExercises('r1', [
      {
        id: 'i1',
        routineId: 'r1',
        exerciseId: 'squat',
        position: 0,
        targetSets: 4,
        targetReps: 8,
        targetWeight: null,
        notes: null,
      },
    ])

    expect(rpcMock).toHaveBeenCalledWith('save_routine_exercises', {
      p_routine_id: 'r1',
      p_items: [
        {
          id: 'i1',
          exercise_id: 'squat',
          position: 0,
          target_sets: 4,
          target_reps: 8,
          target_weight: null,
          notes: null,
        },
      ],
    })
  })

  it('traduce el fallo de la función', async () => {
    rpcMock.mockResolvedValue({ error: { message: '42501 no es tuya' } })
    expect((await saveExercises('r1', [])).error).not.toBeNull()
  })

  it('acepta guardar una lista vacía, que es vaciar la rutina', async () => {
    rpcMock.mockResolvedValue({ error: null })
    expect(await saveExercises('r1', [])).toEqual({ error: null })
  })
})
