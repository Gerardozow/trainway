import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { Routine, RoutineExercise } from './routine-types'

const fetchRoutines = vi.fn()
const fetchRoutine = vi.fn()
const createRoutine = vi.fn()
const deleteRoutine = vi.fn()
const saveExercises = vi.fn()
const loadExercises = vi.fn()

vi.mock('./routine-repository', () => ({
  fetchRoutines: () => fetchRoutines(),
  fetchRoutine: (...a: unknown[]) => fetchRoutine(...a),
  createRoutine: (...a: unknown[]) => createRoutine(...a),
  deleteRoutine: (...a: unknown[]) => deleteRoutine(...a),
  saveExercises: (...a: unknown[]) => saveExercises(...a),
}))

vi.mock('../exercises/exercise-cache', () => ({
  loadExercises: () => loadExercises(),
}))

vi.mock('../exercises/exercise-repository', () => ({
  exerciseImageUrl: (path: string) => `http://test/${path}`,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

const { RoutinesPage } = await import('./RoutinesPage')

const ROUTINE: Routine = {
  id: 'r1',
  ownerId: 'u1',
  name: 'Pierna',
  description: null,
  createdAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-02T10:00:00Z',
}

const ITEM: RoutineExercise = {
  id: 'i1',
  routineId: 'r1',
  exerciseId: 'squat',
  position: 0,
  targetSets: 4,
  targetReps: 8,
  targetWeight: null,
  notes: null,
}

const CATALOG = [
  {
    id: 'squat',
    name: 'Sentadilla con barra',
    category: null,
    equipment: null,
    force: null,
    level: null,
    mechanic: null,
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    instructions: [],
    imagePaths: [],
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <RoutinesPage />
    </MemoryRouter>,
  )
}

describe('RoutinesPage', () => {
  beforeEach(() => {
    fetchRoutines.mockReset().mockResolvedValue([ROUTINE])
    fetchRoutine.mockReset().mockResolvedValue({ routine: ROUTINE, exercises: [ITEM] })
    createRoutine.mockReset().mockResolvedValue({ routine: ROUTINE, error: null })
    deleteRoutine.mockReset().mockResolvedValue({ error: null })
    saveExercises.mockReset().mockResolvedValue({ error: null })
    loadExercises.mockReset().mockResolvedValue(CATALOG)
  })

  it('lista las rutinas del usuario', async () => {
    renderPage()
    expect(await screen.findByText('Pierna')).toBeInTheDocument()
  })

  it('invita a crear la primera cuando no hay ninguna', async () => {
    fetchRoutines.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText(/todavía no tienes rutinas/i)).toBeInTheDocument()
  })

  it('crea una rutina con el nombre escrito', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.type(screen.getByLabelText(/nueva rutina/i), 'Empuje')
    await user.click(screen.getByRole('button', { name: 'Crear' }))

    expect(createRoutine).toHaveBeenCalledWith('u1', 'Empuje')
  })

  it('muestra el error al crear con nombre inválido', async () => {
    createRoutine.mockResolvedValue({ routine: null, error: 'Ponle un nombre' })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Crear' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ponle un nombre')
  })

  it('avisa cuando la carga falla', async () => {
    fetchRoutines.mockRejectedValue(new Error('sin red'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar/i)
  })

  it('pide confirmación antes de borrar', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(deleteRoutine).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '¿Seguro?' }))
    expect(deleteRoutine).toHaveBeenCalledWith('r1')
  })

  it('abre el editor con los ejercicios de la rutina', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Editar' }))

    expect(await screen.findByText('Sentadilla con barra')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /guardar rutina/i })).toBeInTheDocument()
  })

  it('guarda los ejercicios del editor', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByText('Sentadilla con barra')
    await user.click(screen.getByRole('button', { name: /guardar rutina/i }))

    await waitFor(() =>
      expect(saveExercises).toHaveBeenCalledWith('r1', [
        expect.objectContaining({ exerciseId: 'squat', position: 0 }),
      ]),
    )
  })

  it('quita un ejercicio y renumera', async () => {
    fetchRoutine.mockResolvedValue({
      routine: ROUTINE,
      exercises: [ITEM, { ...ITEM, id: 'i2', exerciseId: 'squat', position: 1 }],
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findAllByText('Sentadilla con barra')

    await user.click(screen.getAllByRole('button', { name: /quitar/i })[0])
    await user.click(screen.getByRole('button', { name: /guardar rutina/i }))

    await waitFor(() =>
      expect(saveExercises).toHaveBeenCalledWith('r1', [
        expect.objectContaining({ id: 'i2', position: 0 }),
      ]),
    )
  })

  it('desactiva subir en el primero y bajar en el último', async () => {
    fetchRoutine.mockResolvedValue({
      routine: ROUTINE,
      exercises: [ITEM, { ...ITEM, id: 'i2', position: 1 }],
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findAllByText('Sentadilla con barra')

    expect(screen.getAllByRole('button', { name: /subir/i })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: /bajar/i })[1]).toBeDisabled()
  })

  it('reordena con el botón de bajar', async () => {
    fetchRoutine.mockResolvedValue({
      routine: ROUTINE,
      exercises: [ITEM, { ...ITEM, id: 'i2', position: 1 }],
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findAllByText('Sentadilla con barra')

    await user.click(screen.getAllByRole('button', { name: /bajar/i })[0])
    await user.click(screen.getByRole('button', { name: /guardar rutina/i }))

    await waitFor(() =>
      expect(saveExercises).toHaveBeenCalledWith('r1', [
        expect.objectContaining({ id: 'i2', position: 0 }),
        expect.objectContaining({ id: 'i1', position: 1 }),
      ]),
    )
  })

  it('fija las series objetivo', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByText('Sentadilla con barra')

    const field = screen.getByLabelText(/series objetivo/i)
    await user.clear(field)
    await user.type(field, '5')
    await user.click(screen.getByRole('button', { name: /guardar rutina/i }))

    await waitFor(() =>
      expect(saveExercises).toHaveBeenCalledWith('r1', [
        expect.objectContaining({ targetSets: 5 }),
      ]),
    )
  })

  it('muestra el error si guardar falla', async () => {
    saveExercises.mockResolvedValue({ error: 'No se pudieron guardar' })
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pierna')

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await screen.findByText('Sentadilla con barra')
    await user.click(screen.getByRole('button', { name: /guardar rutina/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron guardar/i)
  })
})
