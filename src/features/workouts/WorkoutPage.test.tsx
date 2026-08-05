import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Workout, WorkoutSet } from './workout-types'

const getActiveWorkout = vi.fn()
const startWorkout = vi.fn()
const addSet = vi.fn()
const removeSet = vi.fn()
const getSetsFor = vi.fn()
const allSets = vi.fn()
const finishWorkout = vi.fn()
const pendingCount = vi.fn()
const flushQueue = vi.fn()
const loadExercises = vi.fn()

vi.mock('./workout-local', () => ({
  getActiveWorkout: () => getActiveWorkout(),
  startWorkout: (...a: unknown[]) => startWorkout(...a),
  addSet: (...a: unknown[]) => addSet(...a),
  removeSet: (...a: unknown[]) => removeSet(...a),
  getSetsFor: (...a: unknown[]) => getSetsFor(...a),
  allSets: () => allSets(),
  finishWorkout: (...a: unknown[]) => finishWorkout(...a),
  pendingCount: () => pendingCount(),
}))

vi.mock('./sync-queue', () => ({ flushQueue: () => flushQueue() }))

vi.mock('../exercises/exercise-cache', () => ({
  loadExercises: () => loadExercises(),
}))

vi.mock('../exercises/exercise-repository', () => ({
  exerciseImageUrl: (path: string) => `http://test/${path}`,
}))

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1' } }, loading: false }),
}))

const { WorkoutPage } = await import('./WorkoutPage')

const WORKOUT: Workout = {
  id: 'w1',
  userId: 'user-1',
  routineId: null,
  startedAt: '2026-08-04T10:00:00Z',
  endedAt: null,
  notes: null,
}

const SET: WorkoutSet = {
  id: 's1',
  workoutId: 'w1',
  exerciseId: 'squat',
  setIndex: 0,
  reps: 8,
  weight: 60,
  rpe: null,
  isWarmup: false,
  completedAt: '2026-08-04T10:05:00Z',
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

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

describe('WorkoutPage', () => {
  beforeEach(() => {
    getActiveWorkout.mockReset().mockResolvedValue(null)
    startWorkout.mockReset().mockResolvedValue(WORKOUT)
    addSet.mockReset().mockResolvedValue(SET)
    removeSet.mockReset().mockResolvedValue(undefined)
    getSetsFor.mockReset().mockResolvedValue([])
    allSets.mockReset().mockResolvedValue([])
    finishWorkout.mockReset().mockResolvedValue(undefined)
    pendingCount.mockReset().mockResolvedValue(0)
    flushQueue.mockReset().mockResolvedValue({ sent: 0, failed: 0 })
    loadExercises.mockReset().mockResolvedValue(CATALOG)
    setOnline(true)
  })

  afterEach(() => setOnline(true))

  it('ofrece empezar cuando no hay entreno activo', async () => {
    render(<WorkoutPage />)
    expect(
      await screen.findByRole('button', { name: /empezar entreno/i }),
    ).toBeInTheDocument()
  })

  it('empieza un entreno al pulsar', async () => {
    const user = userEvent.setup()
    render(<WorkoutPage />)

    await user.click(await screen.findByRole('button', { name: /empezar entreno/i }))

    expect(startWorkout).toHaveBeenCalledWith('user-1')
    expect(await screen.findByText('Sentadilla con barra')).toBeInTheDocument()
  })

  it('retoma el entreno que quedó abierto', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    render(<WorkoutPage />)

    expect(
      await screen.findByRole('button', { name: /terminar entreno/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /empezar entreno/i }),
    ).not.toBeInTheDocument()
  })

  it('registra una serie del ejercicio elegido', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    const user = userEvent.setup()
    render(<WorkoutPage />)

    await user.click(await screen.findByRole('button', { name: /sentadilla con barra/i }))
    await user.type(screen.getByLabelText(/peso/i), '60')
    await user.type(screen.getByLabelText(/repeticiones/i), '8')
    await user.click(screen.getByRole('button', { name: /registrar serie/i }))

    await waitFor(() =>
      expect(addSet).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutId: 'w1',
          exerciseId: 'squat',
          reps: 8,
          weight: 60,
        }),
      ),
    )
  })

  it('lista las series ya registradas', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    getSetsFor.mockResolvedValue([SET])

    render(<WorkoutPage />)

    expect(await screen.findByText(/60 kg × 8/)).toBeInTheDocument()
  })

  it('borra una serie', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    getSetsFor.mockResolvedValue([SET])
    const user = userEvent.setup()

    render(<WorkoutPage />)
    await screen.findByText(/60 kg × 8/)

    await user.click(screen.getByRole('button', { name: /borrar serie/i }))

    expect(removeSet).toHaveBeenCalledWith('s1')
  })

  it('avisa cuando no hay conexión', async () => {
    setOnline(false)
    getActiveWorkout.mockResolvedValue(WORKOUT)
    pendingCount.mockResolvedValue(2)

    render(<WorkoutPage />)

    expect(await screen.findByRole('status')).toHaveTextContent(/sin conexión/i)
  })

  it('no avisa con red y sin pendientes', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    render(<WorkoutPage />)

    await screen.findByRole('button', { name: /terminar entreno/i })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pide confirmación antes de terminar el entreno', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    const user = userEvent.setup()
    render(<WorkoutPage />)

    const button = await screen.findByRole('button', { name: /terminar entreno/i })
    await user.click(button)

    expect(finishWorkout).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /seguro/i }))

    expect(finishWorkout).toHaveBeenCalledWith('w1')
  })

  it('vacía la cola al montar con red', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    render(<WorkoutPage />)

    await waitFor(() => expect(flushQueue).toHaveBeenCalled())
  })

  it('no intenta vaciar la cola sin red', async () => {
    setOnline(false)
    getActiveWorkout.mockResolvedValue(WORKOUT)

    render(<WorkoutPage />)
    await screen.findByRole('button', { name: /terminar entreno/i })

    expect(flushQueue).not.toHaveBeenCalled()
  })

  it('no se queda cargando para siempre si IndexedDB falla', async () => {
    getActiveWorkout.mockRejectedValue(new Error('almacenamiento bloqueado'))

    render(<WorkoutPage />)

    // Sin salida, la pantalla quedaría en "Cargando…" y no habría forma de
    // entrenar ni de saber por qué.
    expect(await screen.findByRole('alert')).toHaveTextContent(/almacenamiento/i)
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument()
  })

  it('muestra el título también mientras carga', () => {
    getActiveWorkout.mockReturnValue(new Promise(() => {}))

    render(<WorkoutPage />)

    expect(screen.getByRole('heading', { name: 'Entrenar' })).toBeInTheDocument()
    expect(screen.getByText(/cargando/i)).toBeInTheDocument()
  })

  it('permite cambiar de ejercicio', async () => {
    getActiveWorkout.mockResolvedValue(WORKOUT)
    const user = userEvent.setup()
    render(<WorkoutPage />)

    await user.click(await screen.findByRole('button', { name: /sentadilla con barra/i }))
    expect(screen.getByLabelText(/peso/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cambiar de ejercicio/i }))

    expect(screen.queryByLabelText(/peso/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/buscar ejercicio/i)).toBeInTheDocument()
  })
})
